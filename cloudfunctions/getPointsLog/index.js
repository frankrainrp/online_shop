// 云函数 getPointsLog —— 读「本人」积分流水（按 openid，云端身份，不依赖客户端安全规则）
// 入参: { limit }
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, msg: '无登录态' };

  const limit = Math.min(Math.max(Number(event && event.limit) || 50, 1), 100);
  const res = await db.collection('points_log')
    .where({ openid: OPENID })
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get()
    .catch(() => ({ data: [] }));

  return { ok: true, list: res.data };
};
