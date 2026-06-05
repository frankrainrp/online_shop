// 云函数 claimAdmin —— 店员/管理员「动态码登录」（建立 7 天会话）
// 模型：一人一密钥
//   · 已有个人密钥(totpSecret)：用本人验证器的 6 位码登录 → 续 7 天会话（角色不变）
//   · 没有 staff 记录：用「主口令」(环境变量 TOTP_SECRET) 引导成为首个/管理员，
//     并自动生成个人密钥，返回 otpauth 供其扫进验证器，下次起用个人码
//   · 有 staff 记录但还没启用个人密钥：提示先到「员工入口」启用（needEnroll）
// 安全：失败锁定(sec_lock) + 一次性消费(sec_otp，按 openid 隔离) + 不回传密钥本身
const cloud = require('wx-server-sdk');
const crypto = require('crypto');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 主口令密钥：仅用于「环境里还没有该 openid 的 staff 记录」时引导管理员。
// 部署时在云函数环境变量设置 TOTP_SECRET（base32，A-Z2-7）。
const MASTER_SECRET = process.env.TOTP_SECRET || 'SET_TOTP_SECRET_IN_CLOUD_ENV';
const STEP = 30, DIGITS = 6, WINDOW = 2;
const SESSION_MS = 7 * 24 * 60 * 60 * 1000; // 登录有效期 7 天

const LOCK_THRESHOLD = 5;
const LOCK_MS = 5 * 60 * 1000;

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(b32) {
  let bits = '';
  const clean = String(b32).replace(/=+$/, '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  for (const c of clean) bits += B32.indexOf(c).toString(2).padStart(5, '0');
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.substr(i, 8), 2));
  return Buffer.from(bytes);
}
function base32Encode(buf) {
  let bits = '';
  for (const b of buf) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.substr(i, 5), 2)];
  return out;
}
function genSecret() {
  return base32Encode(crypto.randomBytes(20)); // 160 位，32 字符
}
function hotp(key, counter) {
  const buf = Buffer.alloc(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) { buf[i] = c & 0xff; c = Math.floor(c / 256); }
  const h = crypto.createHmac('sha1', key).update(buf).digest();
  const off = h[h.length - 1] & 0xf;
  const num = ((h[off] & 0x7f) << 24) | ((h[off + 1] & 0xff) << 16) | ((h[off + 2] & 0xff) << 8) | (h[off + 3] & 0xff);
  return (num % (10 ** DIGITS)).toString().padStart(DIGITS, '0');
}
// 用给定密钥校验码，返回匹配的时间步（用于一次性消费），不匹配返回 null
function matchStep(secret, code) {
  const key = base32Decode(secret);
  const t = Math.floor(Date.now() / 1000 / STEP);
  for (let w = -WINDOW; w <= WINDOW; w++) {
    if (hotp(key, t + w) === String(code)) return t + w;
  }
  return null;
}

async function registerFail(lockCol, lock, openid, now) {
  if (!lock) {
    await lockCol.add({ data: { openid, fails: 1, firstFailAt: now, lockedUntil: 0 } });
    return;
  }
  const within = lock.firstFailAt && (now - lock.firstFailAt) < LOCK_MS;
  const fails = within ? (lock.fails || 0) + 1 : 1;
  const patch = { fails, firstFailAt: within ? lock.firstFailAt : now, lockedUntil: 0 };
  if (fails >= LOCK_THRESHOLD) patch.lockedUntil = now + LOCK_MS;
  await lockCol.doc(lock._id).update({ data: patch });
}

async function audit(openid, name, action, summary) {
  try {
    await db.collection('audit_log').add({ data: { ts: Date.now(), openid, operatorName: name || '', action, targetType: 'auth', targetId: '', summary: summary || '' } });
  } catch (e) { /* 审计失败不阻断主流程 */ }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const code = (event && event.code ? String(event.code) : '').trim();
  const now = Date.now();

  const lockCol = db.collection('sec_lock');
  const lockRes = await lockCol.where({ openid: OPENID }).get();
  const lock = lockRes.data[0];

  // 0. 锁定检查
  if (lock && lock.lockedUntil && lock.lockedUntil > now) {
    const left = Math.ceil((lock.lockedUntil - now) / 60000);
    return { ok: false, msg: `尝试过于频繁，请约 ${left} 分钟后再试` };
  }

  // 1. 格式校验
  if (!/^\d{6}$/.test(code)) {
    await registerFail(lockCol, lock, OPENID, now);
    return { ok: false, msg: '请输入 6 位动态码' };
  }

  // 2. 取本人 staff 记录，决定走「个人密钥」还是「主口令引导」
  const staffCol = db.collection('staff');
  const mineRes = await staffCol.where({ openid: OPENID }).get();
  const mine = mineRes.data[0];

  // 有记录但没启用个人密钥 → 引导去启用（不允许用主口令冒充已存在的店员）
  if (mine && !mine.totpSecret) {
    return { ok: false, msg: '请先在「员工入口」启用你的动态码', needEnroll: true };
  }

  const usingSecret = mine ? mine.totpSecret : MASTER_SECRET;

  const step = matchStep(usingSecret, code);
  if (step === null) {
    await registerFail(lockCol, lock, OPENID, now);
    return { ok: false, msg: '动态码错误或已过期', serverTime: new Date(now).toISOString() };
  }

  // 3. 一次性消费：同一 openid 的同一码（同时间步）用过即作废
  const otpCol = db.collection('sec_otp');
  const used = await otpCol.where({ openid: OPENID, code, step }).count();
  if (used.total > 0) {
    await registerFail(lockCol, lock, OPENID, now);
    return { ok: false, msg: '该动态码已被使用，请用最新的码' };
  }
  await otpCol.add({ data: { code, step, openid: OPENID, usedAt: now } });

  // 4. 成功：清零失败计数
  if (lock) await lockCol.doc(lock._id).update({ data: { fails: 0, firstFailAt: 0, lockedUntil: 0 } });

  const expireAt = now + SESSION_MS;

  // 5. 续会话 / 引导
  if (mine) {
    // 个人密钥登录：仅续会话，角色不变
    await staffCol.doc(mine._id).update({ data: { sessionExpireAt: expireAt } });
    await audit(OPENID, mine.name, '登录', `${mine.role === 'admin' ? '管理员' : '店员'}登录，会话至 ${new Date(expireAt).toLocaleString('zh-CN')}`);
    return { ok: true, msg: '登录成功', role: mine.role, expireAt };
  }

  // 主口令引导：成为管理员 + 生成个人密钥 + 建会话，返回 otpauth 供扫码
  const secret = genSecret();
  const label = encodeURIComponent('是模玩店:店长');
  const issuer = encodeURIComponent('是模玩店');
  const otpauth = `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&period=${STEP}&digits=${DIGITS}&algorithm=SHA1`;
  const doc = {
    openid: OPENID, name: '店长', jobNo: 'D' + String(now).slice(-4),
    role: 'admin', totpSecret: secret, sessionExpireAt: expireAt, createdAt: now
  };
  await staffCol.add({ data: doc });
  await audit(OPENID, '店长', '提权', '主口令引导为管理员并生成个人密钥');
  return { ok: true, msg: '已成为管理员', role: 'admin', expireAt, enroll: { secret, otpauth } };
};
