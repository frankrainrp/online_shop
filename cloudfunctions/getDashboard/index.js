// 云函数 getDashboard —— 店长经营看板（仅 admin + 会话有效）
// 入参: { range: 'today' | '7d' | '30d' }
// 数据全部来自现成集合：points_log / users / redeems
// 复用规则：1 元 = 1 分（消费分总和≈营业额）；100 分 = 1 元（抵现让利）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const $ = db.command.aggregate;

const Y2P = 1;    // 同步 utils/config.js POINT_RULES.YUAN_TO_POINT
const P2Y = 100;  // 同步 utils/config.js POINT_RULES.POINT_TO_YUAN
const TZ = 8 * 3600 * 1000; // 北京时区，用于「今日」零点

function sinceOf(range) {
  const now = Date.now();
  if (range === '7d') return now - 7 * 86400000;
  if (range === '30d') return now - 30 * 86400000;
  // today：北京时间当日零点
  const local = now + TZ;
  const dayStartLocal = local - (local % 86400000);
  return dayStartLocal - TZ;
}

// 对 points_log 按条件求 delta 之和（用聚合，避免 get 条数上限）
async function sumDelta(match) {
  const res = await db.collection('points_log').aggregate()
    .match(match)
    .group({ _id: null, total: $.sum('$delta'), cnt: $.sum(1) })
    .end()
    .catch(() => ({ list: [] }));
  const row = res.list && res.list[0];
  return { total: row ? row.total : 0, cnt: row ? row.cnt : 0 };
}

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

  const range = ['today', '7d', '30d'].indexOf(event && event.range) >= 0 ? event.range : 'today';
  const since = sinceOf(range);

  // 1. 消费（营业额估算 + 笔数）
  const consume = await sumDelta({ type: '消费', createdAt: _.gte(since) });
  // 2. 抵现（让利金额）
  const deduct = await sumDelta({ type: '抵现', createdAt: _.gte(since) });
  // 3. 积分发放 / 消耗
  const issued = await sumDelta({ delta: _.gt(0), createdAt: _.gte(since) });
  const used = await sumDelta({ delta: _.lt(0), createdAt: _.gte(since) });
  // 4. 新增会员
  const newMembers = await db.collection('users').where({ createdAt: _.gte(since) }).count().catch(() => ({ total: 0 }));
  // 5. 核销数
  const verified = await db.collection('redeems').where({ status: '已完成', verifiedAt: _.gte(since) }).count().catch(() => ({ total: 0 }));

  return {
    ok: true,
    range,
    since,
    stats: {
      sales: Math.round((consume.total || 0) / Y2P),          // 营业额(元)
      txCount: consume.cnt || 0,                              // 消费笔数
      deductYuan: Math.round((Math.abs(deduct.total) || 0) / P2Y), // 抵现让利(元)
      newMembers: newMembers.total || 0,                      // 新增会员
      verified: verified.total || 0,                          // 核销数
      pointsIssued: issued.total || 0,                        // 积分发放
      pointsUsed: Math.abs(used.total) || 0                   // 积分消耗
    }
  };
};
