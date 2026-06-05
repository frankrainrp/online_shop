// 云函数 bindPhone —— 新客微信手机号一键登录，把手机号绑定到当前会员
// 入参: { code }  来自 <button open-type="getPhoneNumber"> 的 e.detail.code（新版基础库 2.21.2+）
// 说明：调用 cloud.openapi.phonenumber.getPhoneNumber 换取手机号，需小程序「已认证」且开通该接口
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const NEW_MEMBER_BONUS = 120; // 入会礼（同步 utils/config.js）；改为「绑定手机号后」发放

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const code = event && typeof event.code === 'string' ? event.code : '';
  if (!OPENID) return { ok: false, msg: '无登录态' };
  if (!code) return { ok: false, msg: '缺少手机号凭证 code' };

  // 换取手机号
  let phone = '';
  try {
    const r = await cloud.openapi.phonenumber.getPhoneNumber({ code });
    phone = (r && r.phoneInfo && r.phoneInfo.phoneNumber) || '';
  } catch (e) {
    return { ok: false, msg: '手机号获取失败：' + ((e && (e.errMsg || e.message)) || '请确认小程序已认证并开通手机号能力') };
  }
  if (!/^\d{6,15}$/.test(phone)) return { ok: false, msg: '未获取到有效手机号' };

  const res = await db.collection('users').where({ openid: OPENID }).get();
  if (!res.data.length) return { ok: false, msg: '会员不存在，请重新进入小程序' };
  const uid = res.data[0]._id;

  await db.collection('users').doc(uid).update({ data: { phone, phoneBoundAt: Date.now() } });

  // 入会礼：仅当「从未发过」（newBonusGiven===false）才发，原子置 true 防并发/重复
  let joinBonus = 0;
  const now = Date.now();
  const claim = await db.collection('users')
    .where({ _id: uid, newBonusGiven: false })
    .update({ data: { newBonusGiven: true, points: _.inc(NEW_MEMBER_BONUS), growth: _.inc(NEW_MEMBER_BONUS) } });
  if (claim.stats.updated === 1) {
    joinBonus = NEW_MEMBER_BONUS;
    const after = await db.collection('users').doc(uid).get().catch(() => null);
    await db.collection('points_log').add({
      data: {
        userId: uid, openid: OPENID, type: '入会', delta: NEW_MEMBER_BONUS,
        balance: after && after.data ? after.data.points : NEW_MEMBER_BONUS,
        orderNo: 'W' + now, remark: '新客入会礼（绑定手机号）', createdAt: now
      }
    });
  }

  // 只回脱敏号，避免明文在前端到处传
  const masked = phone.replace(/^(\d{3})\d+(\d{4})$/, '$1****$2');
  return { ok: true, phoneMasked: masked, joinBonus };
};
