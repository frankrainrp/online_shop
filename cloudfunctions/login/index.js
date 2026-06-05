// 云函数 login —— 拿 openid + upsert 会员 + 判断是否店员
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const NEW_MEMBER_BONUS = 120; // 新客入会赠送积分（同步 utils/config.js）

exports.main = async (event) => {
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
      points: 0,                  // 入会礼改到「绑定手机号后」发放（见 bindPhone），静默注册不发分
      growth: 0,
      level: '普通会员',
      lastSignAt: 0,              // 便于签到原子判断
      newBonusGiven: false,       // 入会礼是否已发（绑手机号时原子置 true，防重复）
      createdAt: now
    };

    // 邀请有礼：仅「首次注册」绑定邀请人；奖励等新人到店消费时才发（见 addPoints）
    const inviter = (event && typeof event.inviter === 'string') ? event.inviter.trim() : '';
    if (inviter) {
      const inv = await usersCol.doc(inviter).get().catch(() => null);
      // 邀请人必须存在，且不是自己（openid 不同）
      if (inv && inv.data && inv.data.openid !== OPENID) {
        doc.invitedBy = inviter;
        doc.inviteRewarded = false;
      }
    }

    const add = await usersCol.add({ data: doc });
    user = { _id: add._id, ...doc };
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
