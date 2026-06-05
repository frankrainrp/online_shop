// 云函数 redeemGoods —— 会员用积分兑换商品（生成兑换单，待店员核销）
// 入参: { goodsId }
// 安全：库存/积分均用「原子条件更新」防并发刷单、防超兑、防负积分；下架商品不可兑
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

function genCode() {
  const d = new Date();
  const p = n => (n < 10 ? '0' + n : '' + n);
  const rnd = Math.floor(1000 + Math.random() * 9000);
  return `E${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${rnd}`;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const goodsId = event && typeof event.goodsId === 'string' ? event.goodsId : '';
  if (!goodsId) return { ok: false, msg: '参数错误' };

  const usersCol = db.collection('users');
  const goodsCol = db.collection('goods');

  // 1. 读会员
  const userRes = await usersCol.where({ openid: OPENID }).get();
  if (!userRes.data.length) return { ok: false, msg: '会员不存在' };
  const user = userRes.data[0];
  if (!user.phone) return { ok: false, msg: '请先用微信手机号登录后再兑换', needLogin: true };

  // 2. 读商品 + 业务校验（积分价以服务端为准，不信任何前端传值）
  const goodsRes = await goodsCol.doc(goodsId).get().catch(() => null);
  if (!goodsRes || !goodsRes.data) return { ok: false, msg: '商品不存在' };
  const goods = goodsRes.data;
  if (goods.status !== 'on') return { ok: false, msg: '商品已下架' };
  const cost = Number(goods.cost) || 0;
  if (cost <= 0) return { ok: false, msg: '商品配置异常' };

  // 3. 原子扣库存：仅当 stock>0 才会更新成功（并发下也不会扣成负数）
  const decStock = await goodsCol.where({ _id: goodsId, stock: _.gt(0) }).update({ data: { stock: _.inc(-1) } });
  if (decStock.stats.updated === 0) return { ok: false, msg: '已兑完' };

  // 4. 原子扣积分：仅当 points>=cost 才会更新成功（防并发 double-spend / 负积分）
  const decPts = await usersCol.where({ _id: user._id, points: _.gte(cost) }).update({ data: { points: _.inc(-cost) } });
  if (decPts.stats.updated === 0) {
    // 积分不足 → 回滚刚扣的库存
    await goodsCol.doc(goodsId).update({ data: { stock: _.inc(1) } });
    return { ok: false, msg: '积分不足' };
  }

  // 5. 生成兑换单 + 流水（余额以数据库回读为准）
  const code = genCode();
  const now = Date.now();
  const add = await db.collection('redeems').add({
    data: {
      userId: user._id, openid: OPENID, goodsId,
      goodsName: goods.name, goodsImage: goods.image || '', cost, code,
      status: '待核销', createdAt: now, verifiedAt: null, verifiedBy: ''
    }
  });

  const after = await usersCol.doc(user._id).get().catch(() => null);
  const balance = after && after.data ? after.data.points : (user.points - cost);

  await db.collection('points_log').add({
    data: {
      userId: user._id, openid: OPENID, type: '兑换', delta: -cost,
      balance, orderNo: code, remark: `兑换 ${goods.name}`, createdAt: now
    }
  });

  return { ok: true, code, redeemId: add._id, balance };
};
