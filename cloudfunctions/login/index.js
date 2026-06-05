// 云函数 login —— 拿 openid + upsert 会员 + 判断是否店员
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const NEW_MEMBER_BONUS = 120; // 新客入会赠送积分（同步 utils/config.js）

exports.main = async () => {
  const { OPENID } = cloud.getWXContext();
  const usersCol = db.collection('users');
  const staffCol = db.collection('staff');

  // upsert 会员
  let user;
  let isNew = false;
  const found = await usersCol.where({ openid: OPENID }).get();
  if (found.data.length) {
    user = found.data[0];
  } else {
    isNew = true;
    const now = Date.now();
    const doc = {
      openid: OPENID,
      nickName: '新会员',
      avatarUrl: '',
      points: NEW_MEMBER_BONUS,   // 入会即送
      growth: NEW_MEMBER_BONUS,   // 成长值（只增不减，决定等级）
      level: '普通会员',
      lastSignAt: 0,              // 便于签到原子判断
      createdAt: now
    };
    const add = await usersCol.add({ data: doc });
    user = { _id: add._id, ...doc };

    // 写入会赠送流水
    await db.collection('points_log').add({
      data: {
        userId: add._id,
        openid: OPENID,
        type: '入会',
        delta: NEW_MEMBER_BONUS,
        balance: NEW_MEMBER_BONUS,
        orderNo: 'W' + now,
        remark: '新客入会礼',
        createdAt: now
      }
    });
  }

  // 是否店员（按 7 天会话判定：在白名单 + 会话未过期才算「已登录店员」）
  const staffRes = await staffCol.where({ openid: OPENID }).get();
  const s = staffRes.data[0] || null;
  const nowTs = Date.now();
  const sessionValid = !!(s && s.sessionExpireAt && s.sessionExpireAt > nowTs);
  const isStaff = sessionValid;
  const isAdmin = sessionValid && s.role === 'admin';

  // 回传时隐去 totpSecret（密钥绝不出云端）
  let staffInfo = null;
  let staffState = null;
  if (s) {
    staffInfo = {
      _id: s._id, openid: s.openid, name: s.name, jobNo: s.jobNo,
      role: s.role, sessionExpireAt: s.sessionExpireAt || 0
    };
    staffState = {
      exists: true,
      role: s.role,
      hasSecret: !!s.totpSecret,       // 是否已启用个人密钥
      sessionValid,                    // 会话是否有效
      sessionExpireAt: s.sessionExpireAt || 0
    };
  }

  return {
    openid: OPENID,
    user,
    isNew,
    isStaff,
    isAdmin,
    staffInfo,
    staffState
  };
};
