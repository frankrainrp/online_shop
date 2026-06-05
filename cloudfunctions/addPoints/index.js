// 云函数 addPoints —— 店员给会员加分/扣分（核心！必须店员鉴权）
// 入参: { targetUserId, delta, type, remark }
//   delta > 0 加分（消费/签到/活动）, delta < 0 扣分
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const ALLOW_TYPES = ['消费', '签到', '活动', '兑换', '店员调整', '抵现'];
const MAX_DELTA = 100000; // 单次加/扣分上限，防误操作/被刷
const INVITE_REWARD = 1500; // 邀请有礼：新人首次消费后，邀请人/新人各得（同步 utils/config.js）

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

  // 1.5 会话校验：登录满 7 天失效，须到员工入口重新动态码认证
  if (!(operator.sessionExpireAt && operator.sessionExpireAt > Date.now())) {
    return { ok: false, msg: '登录已过期，请到员工入口重新认证', expired: true };
  }

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

  // 5. 审计：谁、给谁、加/扣了多少、余额
  try {
    await db.collection('audit_log').add({
      data: {
        ts: Date.now(),
        openid: OPENID,
        operatorName: operator.name || operator.jobNo || '',
        action: delta > 0 ? '加分' : '扣分',
        targetType: 'user',
        targetId: targetUserId,
        summary: `${cur.nickName || '会员'} ${delta > 0 ? '+' : ''}${delta}分（${type}）→ 余 ${newBalance}`
      }
    });
  } catch (e) { /* 审计失败不阻断 */ }

  // 6. 邀请有礼结算：新人「首次消费」触发，双方各 +INVITE_REWARD（只发一次）
  let inviteReward = 0;
  if (type === '消费' && cur.invitedBy && cur.inviteRewarded === false) {
    // 原子占用：仅当 inviteRewarded 仍为 false 才置 true，防并发重复发奖
    const claim = await usersCol.where({ _id: targetUserId, inviteRewarded: false })
      .update({ data: { inviteRewarded: true } });
    if (claim.stats.updated === 1) {
      const now = Date.now();
      // 新人侧 +奖励
      await usersCol.doc(targetUserId).update({ data: { points: _.inc(INVITE_REWARD), growth: _.inc(INVITE_REWARD) } });
      const newcomerBal = (await usersCol.doc(targetUserId).get().catch(() => null));
      await db.collection('points_log').add({
        data: {
          userId: targetUserId, openid: cur.openid, type: '活动', delta: INVITE_REWARD,
          balance: newcomerBal && newcomerBal.data ? newcomerBal.data.points : null,
          orderNo: 'IV' + now + '1', remark: '邀请有礼·受邀奖励', operator: '系统', createdAt: now
        }
      });
      // 邀请人侧 +奖励 + 拉新数 +1（邀请人可能已不存在，catch 兜底）
      const inviter = await usersCol.doc(cur.invitedBy).get().catch(() => null);
      if (inviter && inviter.data) {
        await usersCol.doc(cur.invitedBy).update({ data: { points: _.inc(INVITE_REWARD), growth: _.inc(INVITE_REWARD), inviteCount: _.inc(1) } });
        await db.collection('points_log').add({
          data: {
            userId: cur.invitedBy, openid: inviter.data.openid, type: '活动', delta: INVITE_REWARD,
            balance: (inviter.data.points || 0) + INVITE_REWARD,
            orderNo: 'IV' + now + '2', remark: `邀请有礼·成功邀请「${cur.nickName || '新会员'}」`, operator: '系统', createdAt: now
          }
        });
      }
      try {
        await db.collection('audit_log').add({
          data: { ts: now, openid: OPENID, operatorName: operator.name || operator.jobNo || '', action: '邀请奖励', targetType: 'user', targetId: targetUserId, summary: `${cur.nickName || '新会员'} 首消触发邀请有礼，双方各 +${INVITE_REWARD}` }
        });
      } catch (e) { /* ignore */ }
      inviteReward = INVITE_REWARD;
    }
  }

  return { ok: true, balance: newBalance, orderNo, inviteReward };
};
