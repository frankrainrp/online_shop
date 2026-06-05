// 云函数 updateProfile —— 安全地更新会员资料
// 只接受白名单字段（nickName / avatarUrl），杜绝前端篡改 points/growth/level
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 白名单字段 + 各自最大长度（avatarUrl 存的是云存储 fileID，会很长）
const ALLOW = { nickName: 50, avatarUrl: 512 };

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, msg: '无登录态' };

  // 只挑白名单字段，其余一律丢弃
  const patch = {};
  for (const k in ALLOW) {
    const v = event[k];
    if (typeof v !== 'string' || v.length === 0 || v.length > ALLOW[k]) continue;
    // avatarUrl 只允许云存储或 https 图片，杜绝 data:/javascript:/外部追踪链接
    if (k === 'avatarUrl' && !/^(cloud:\/\/|https:\/\/)/.test(v)) continue;
    patch[k] = v;
  }
  if (Object.keys(patch).length === 0) return { ok: false, msg: '没有可更新的字段' };

  const res = await db.collection('users').where({ openid: OPENID }).get();
  if (!res.data.length) return { ok: false, msg: '会员不存在' };

  await db.collection('users').doc(res.data[0]._id).update({ data: patch });
  return { ok: true, patch };
};
