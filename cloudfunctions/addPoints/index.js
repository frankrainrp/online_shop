// 云函数 addPoints —— 店员给会员加分/扣分（核心！必须店员鉴权）
// 入参: { targetUserId, delta, type, remark }
//   delta > 0 加分（消费/签到/活动）, delta < 0 扣分
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const ALLOW_TYPES = ['消费', '签到', '活动', '兑换', '店员调整'];
const MAX_DELTA = 100000; // 单次加/扣分上限，防误操作/被刷

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const targetUserId = event && typeof event.targetUserId === 'string' ? event.targetUserId : '';
  let { delta } = event;
  const type = ALLOW_TYPES.indexOf(event && event.type) >= 0 ? event.type : '店员调整';
  const remark = (event && typeof event.remark === 'string') ? event.remark.slice(0, 100) : '';

  // 1. 鉴权：调用者必须是店员
  const staff = await db.collection('staff').where({ openid: OPENID }).get();
  if (!staff.data.length) {
    return { ok: false, msg: '无权限：仅店员可加扣积分' };
  }
  const operator = staff.data[0];

  // 2. 参数校验：delta 必须是整数且在合理范围
  delta = Number(delta);
  if (!targetUserId || !Number.isInteger(delta) || delta === 0 || Math.abs(delta) > MAX_DELTA) {
    return { ok: false, msg: '参数错误（分值须为非零整数且不超过 ' + MAX_DELTA + '）' };
  }

  // 3. 读取目标会员
  const usersCol = db.collection('users');
  const target = await usersCol.doc(targetUserId).get().catch(() => null);
  if (!target || !target.data) {
    return { ok: false, msg: '会员不存在' };
  }
  const cur = target.data;

  // 4. 更新积分；成长值只在加分时增加
  const growthInc = delta > 0 ? delta : 0;
  if (delta < 0) {
    // 扣分：原子条件更新，仅当余额足够（防并发扣成负数）
    const upd = await usersCol.where({ _id: targetUserId, points: _.gte(-delta) })
      .update({ data: { points: _.inc(delta) } });
    if (upd.stats.updated === 0) return { ok: false, msg: '积分不足，无法扣减' };
  } else {
    // 加分
    await usersCol.doc(targetUserId).update({ data: { points: _.inc(delta), growth: _.inc(growthInc) } });
  }

  // 回读最新余额
  const after = await usersCol.doc(targetUserId).get().catch(() => null);
  const newBalance = after && after.data ? after.data.points : (cur.points + delta);

  // 4. 写流水
  const orderNo = 'D' + Date.now() + Math.floor(Math.random() * 1000);
  await db.collection('points_log').add({
    data: {
      userId: targetUserId,
      openid: cur.openid,
      type,                 // 消费 / 签到 / 活动 / 兑换 / 店员调整
      delta,
      balance: newBalance,
      orderNo,
      remark,
      operator: operator.name || operator.jobNo || '',
      createdAt: Date.now()
    }
  });

  return { ok: true, balance: newBalance, orderNo };
};
