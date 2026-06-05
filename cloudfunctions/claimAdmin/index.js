// 云函数 claimAdmin —— 凭"动态口令(TOTP)"成为管理员
// 安全：RFC6238 TOTP（30s 轮换）+ 失败锁定（防暴力）+ 一次性消费（防重放）
const cloud = require('wx-server-sdk');
const crypto = require('crypto');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// ⚠️ 密钥不再硬编码进代码（防止推到 GitHub 泄露）。
// 部署时在「云开发控制台 → 云函数 claimAdmin → 配置 → 环境变量」里设置 TOTP_SECRET（base32，仅 A-Z2-7）。
// 把同一个密钥加进身份验证器 App（手动/基于时间）。未配置时用占位符（无法通过校验）。
const TOTP_SECRET = process.env.TOTP_SECRET || 'SET_TOTP_SECRET_IN_CLOUD_ENV';
const STEP = 30, DIGITS = 6, WINDOW = 2;

const LOCK_THRESHOLD = 5;             // 连续失败次数上限
const LOCK_MS = 5 * 60 * 1000;        // 锁定时长 / 失败统计窗口

function base32Decode(b32) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  const clean = String(b32).replace(/=+$/, '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  for (const c of clean) bits += A.indexOf(c).toString(2).padStart(5, '0');
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.substr(i, 8), 2));
  return Buffer.from(bytes);
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
// 返回匹配的时间步（用于一次性消费记录），不匹配返回 null
function matchStep(code) {
  const key = base32Decode(TOTP_SECRET);
  const t = Math.floor(Date.now() / 1000 / STEP);
  for (let w = -WINDOW; w <= WINDOW; w++) {
    if (hotp(key, t + w) === String(code)) return t + w;
  }
  return null;
}

// 记录一次失败，达到阈值则锁定
async function registerFail(lockCol, lock, openid, now) {
  if (!lock) {
    await lockCol.add({ data: { openid, fails: 1, firstFailAt: now, lockedUntil: 0 } });
    return;
  }
  // 统计窗口过期则重置计数
  const within = lock.firstFailAt && (now - lock.firstFailAt) < LOCK_MS;
  const fails = within ? (lock.fails || 0) + 1 : 1;
  const patch = { fails, firstFailAt: within ? lock.firstFailAt : now, lockedUntil: 0 };
  if (fails >= LOCK_THRESHOLD) patch.lockedUntil = now + LOCK_MS;
  await lockCol.doc(lock._id).update({ data: patch });
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

  // 2. 校验 TOTP
  const step = matchStep(code);
  if (step === null) {
    await registerFail(lockCol, lock, OPENID, now);
    return { ok: false, msg: '动态码错误或已过期', serverTime: new Date(now).toISOString() };
  }

  // 3. 一次性消费：同一个码（同一时间步）用过即作废，杜绝窗口内重放
  const otpCol = db.collection('sec_otp');
  const used = await otpCol.where({ code, step }).count();
  if (used.total > 0) {
    await registerFail(lockCol, lock, OPENID, now);
    return { ok: false, msg: '该动态码已被使用，请用最新的码' };
  }
  await otpCol.add({ data: { code, step, openid: OPENID, usedAt: now } });

  // 4. 成功：清零失败计数
  if (lock) await lockCol.doc(lock._id).update({ data: { fails: 0, firstFailAt: 0, lockedUntil: 0 } });

  // 5. 授予管理员
  const staffCol = db.collection('staff');
  const exist = await staffCol.where({ openid: OPENID }).get();
  if (exist.data.length) {
    await staffCol.doc(exist.data[0]._id).update({ data: { role: 'admin' } });
    return { ok: true, msg: '已升级为管理员' };
  }
  await staffCol.add({
    data: { openid: OPENID, name: '店长', jobNo: 'D' + String(now).slice(-4), role: 'admin', createdAt: now }
  });
  return { ok: true, msg: '已成为管理员' };
};
