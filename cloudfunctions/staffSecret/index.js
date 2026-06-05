// 云函数 staffSecret —— 店员「自助启用个人动态码密钥」
// 前提：调用者已被店长加入 staff 集合（白名单）。本函数为其生成一次性的 TOTP 密钥，
// 返回 otpauth URI（扫进 Google Authenticator/微信「身份验证器」等），之后用 claimAdmin 输码登录。
// 入参: { reset: true }  —— 已启用过、需要更换设备时重置（会作废旧密钥并清除会话）
const cloud = require('wx-server-sdk');
const crypto = require('crypto');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const STEP = 30, DIGITS = 6;
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf) {
  let bits = '';
  for (const b of buf) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.substr(i, 5), 2)];
  return out;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const reset = !!(event && event.reset);

  const staffCol = db.collection('staff');
  const res = await staffCol.where({ openid: OPENID }).get();
  const mine = res.data[0];
  if (!mine) return { ok: false, msg: '你还不是店员，请联系店长添加后再启用' };

  // 已启用且非重置 → 不重复下发（密钥只在生成时可见一次）
  if (mine.totpSecret && !reset) {
    return { ok: false, msg: '你已启用动态码。如更换手机需重置，请用「重置」', already: true };
  }

  const secret = base32Encode(crypto.randomBytes(20)); // 160 位
  // 启用即作废旧会话，强制用新密钥重新登录
  await staffCol.doc(mine._id).update({ data: { totpSecret: secret, sessionExpireAt: 0 } });

  const label = encodeURIComponent('是模玩店:' + (mine.name || mine.jobNo || '店员'));
  const issuer = encodeURIComponent('是模玩店');
  const otpauth = `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&period=${STEP}&digits=${DIGITS}&algorithm=SHA1`;

  try {
    await db.collection('audit_log').add({ data: { ts: Date.now(), openid: OPENID, operatorName: mine.name || '', action: reset ? '重置动态码' : '启用动态码', targetType: 'auth', targetId: mine._id, summary: '' } });
  } catch (e) { /* ignore */ }

  return { ok: true, secret, otpauth, name: mine.name || '店员' };
};
