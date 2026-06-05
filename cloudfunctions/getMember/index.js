// 云函数 getMember —— 店员按会员号查会员（店员鉴权后才返回）
// 入参: { memberNo }  （= users._id，会员码页展示给店员的号）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();

  // 鉴权：只有店员能查会员
  const staff = await db.collection('staff').where({ openid: OPENID }).get();
  if (!staff.data.length) return { ok: false, msg: '无权限：仅店员可查询会员' };
  const op = staff.data[0];
  if (!(op.sessionExpireAt && op.sessionExpireAt > Date.now())) {
    return { ok: false, msg: '登录已过期，请到员工入口重新认证', expired: true };
  }

  const { memberNo } = event;
  if (!memberNo) return { ok: false, msg: '请提供会员号' };

  const res = await db.collection('users').doc(memberNo).get().catch(() => null);
  if (!res || !res.data) return { ok: false, msg: '会员不存在' };

  // 只回必要字段，不泄露多余信息
  const u = res.data;
  return {
    ok: true,
    member: {
      _id: u._id,
      nickName: u.nickName,
      level: u.level,
      points: u.points,
      growth: u.growth
    }
  };
};
