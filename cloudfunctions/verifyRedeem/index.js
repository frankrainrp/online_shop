// 云函数 verifyRedeem —— 店员核销兑换单（凭兑换码）
// 入参: { code }
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const code = event && typeof event.code === 'string' ? event.code.trim() : '';

  // 鉴权
  const staff = await db.collection('staff').where({ openid: OPENID }).get();
  if (!staff.data.length) return { ok: false, msg: '无权限：仅店员可核销' };
  const operator = staff.data[0];

  if (!code) return { ok: false, msg: '请提供兑换码' };

  const col = db.collection('redeems');
  const res = await col.where({ code }).get();
  if (!res.data.length) return { ok: false, msg: '兑换码不存在' };
  const redeem = res.data[0];
  if (redeem.status === '已取消') return { ok: false, msg: '该券已取消' };

  // 原子核销：仅当当前状态为「待核销」才置为「已完成」
  // 并发两次扫码，只有一个 updated===1，杜绝重复核销
  const upd = await col.where({ _id: redeem._id, status: '待核销' }).update({
    data: {
      status: '已完成',
      verifiedAt: Date.now(),
      verifiedBy: operator.name || operator.jobNo || ''
    }
  });
  if (upd.stats.updated === 0) return { ok: false, msg: '该券已核销' };

  return { ok: true, goodsName: redeem.goodsName, msg: '核销成功' };
};
