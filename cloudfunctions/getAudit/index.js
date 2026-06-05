// 云函数 getAudit —— 店长查看操作日志（仅 admin + 会话有效）
// 入参: { limit, action, beforeTs }
//   action 可选筛选（如 '加分'/'核销'/'登录' 等）；beforeTs 用于分页（取更早的）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();

  // 鉴权：仅管理员 + 会话有效
  const staff = await db.collection('staff').where({ openid: OPENID }).get();
  if (!staff.data.length || staff.data[0].role !== 'admin') {
    return { ok: false, msg: '无权限：仅管理员可查看' };
  }
  const op = staff.data[0];
  if (!(op.sessionExpireAt && op.sessionExpireAt > Date.now())) {
    return { ok: false, msg: '登录已过期，请到员工入口重新认证', expired: true };
  }

  const limit = Math.min(Math.max(Number(event && event.limit) || 30, 1), 100);
  const where = {};
  if (event && event.action) where.action = String(event.action);
  if (event && event.beforeTs) where.ts = _.lt(Number(event.beforeTs));

  const res = await db.collection('audit_log')
    .where(where)
    .orderBy('ts', 'desc')
    .limit(limit)
    .get()
    .catch(() => ({ data: [] }));

  return { ok: true, list: res.data, hasMore: res.data.length === limit };
};
