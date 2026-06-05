// 云函数 resignStaff —— 退出员工/管理员身份（只能退自己）
// 用途：方便测试 OTP 重新认证；或离职时自助退出
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async () => {
  const { OPENID } = cloud.getWXContext();
  const res = await db.collection('staff').where({ openid: OPENID }).get();
  if (!res.data.length) return { ok: true, msg: '你本来就不是员工' };
  await db.collection('staff').doc(res.data[0]._id).remove();
  return { ok: true, msg: '已退出员工身份' };
};
