// 云函数 signIn —— 会员每日签到领积分
// 安全：用「原子条件更新」保证一天只能签一次，并发请求也只有一个能成功
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const SIGN_REWARD = 10; // 每日签到积分（同步 utils/config.js）

// 当天 0 点（东八区）的时间戳
function todayStartCN() {
  const now = new Date(Date.now() + 8 * 3600 * 1000);
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 8 * 3600 * 1000;
}

exports.main = async () => {
  const { OPENID } = cloud.getWXContext();
  const usersCol = db.collection('users');

  const res = await usersCol.where({ openid: OPENID }).get();
  if (!res.data.length) return { ok: false, msg: '会员不存在，请重新进入小程序' };
  const user = res.data[0];

  const dayStart = todayStartCN();
  const now = Date.now();
  const signData = { points: _.inc(SIGN_REWARD), growth: _.inc(SIGN_REWARD), lastSignAt: now };

  // 原子签到：仅当 lastSignAt < 今天0点 才更新成功（并发只会有一个成功）
  let upd = await usersCol.where({ openid: OPENID, lastSignAt: _.lt(dayStart) }).update({ data: signData });
  // 兼容历史用户没有 lastSignAt 字段的情况
  if (upd.stats.updated === 0 && user.lastSignAt === undefined) {
    upd = await usersCol.where({ openid: OPENID, lastSignAt: _.exists(false) }).update({ data: signData });
  }
  if (upd.stats.updated === 0) {
    return { ok: false, msg: '今天已经签到过啦', already: true };
  }

  // 回读最新余额写流水
  const after = await usersCol.doc(user._id).get().catch(() => null);
  const balance = after && after.data ? after.data.points : (user.points + SIGN_REWARD);
  await db.collection('points_log').add({
    data: {
      userId: user._id, openid: OPENID, type: '签到', delta: SIGN_REWARD,
      balance, orderNo: 'S' + now, remark: '每日签到', createdAt: now
    }
  });

  return { ok: true, reward: SIGN_REWARD, balance };
};
