// 云函数 init —— 一键初始化（幂等，可重复调用）
// 作用：建 6 张集合 + 灌示例 goods/updates + 可把调用者设为店员
// 入参: { makeMeStaff: true }  传 true 时把当前 openid 加入 staff
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const COLLECTIONS = ['users', 'points_log', 'goods', 'redeems', 'staff', 'updates', 'banners', 'sec_lock', 'sec_otp', 'audit_log'];

// 示例轮播图
const BANNERS = [
  { title: '新客入会 送120积分', image: '', link: '', sort: 1 },
  { title: '五一模玩节 双倍积分', image: '', link: '', sort: 2 },
  { title: '新品到货 抢先兑', image: '', link: '', sort: 3 }
];

// 示例商品
const GOODS = [
  { name: '10元优惠券', category: '优惠券', cost: 100, stock: 999, image: '', status: 'on' },
  { name: '20元优惠券', category: '优惠券', cost: 200, stock: 999, image: '', status: 'on' },
  { name: '随机贴纸包', category: '贴纸', cost: 80, stock: 50, image: '', status: 'on' },
  { name: '亚克力小挂件', category: '周边', cost: 150, stock: 30, image: '', status: 'on' },
  { name: '限定明信片套装', category: '周边', cost: 120, stock: 40, image: '', status: 'on' },
  { name: '微氪盲盒（随机）', category: '盲盒', cost: 200, stock: 20, image: '', status: 'on' }
];

// 示例动态
const UPDATES = [
  { type: '新品到货', title: 'METAL BUILD 红异端高达', desc: '全新红异端高达来袭，细节升级！现已到店，数量有限。', image: '' },
  { type: '活动预告', title: '五一模玩节 双倍积分', desc: '活动期间全场订单享双倍积分，攒分兑好礼就趁现在。', image: '' },
  { type: '新品到货', title: 'POP UP PARADE 初音未来', desc: '人气虚拟歌姬，清新登场。手办爱好者不要错过。', image: '' },
  { type: '店铺公告', title: '快递停发通知（五一假期）', desc: '5月1日-5日暂停发货，6日恢复正常，敬请谅解。', image: '' }
];

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const log = [];

  // 0. 防滥用：系统已初始化（已有管理员）后，非管理员调用直接拒绝
  //    首次 bootstrap（还没有任何管理员/集合）仍放行
  const adminCount0 = await db.collection('staff').where({ role: 'admin' }).count().catch(() => ({ total: 0 }));
  if (adminCount0.total > 0) {
    const mine = OPENID
      ? await db.collection('staff').where({ openid: OPENID, role: 'admin' }).count().catch(() => ({ total: 0 }))
      : { total: 0 };
    if (mine.total === 0) return { ok: false, msg: '系统已初始化，无需重复操作' };
  }

  // 1. 建集合（已存在会抛错，忽略即可）
  for (const name of COLLECTIONS) {
    try {
      await db.createCollection(name);
      log.push(`建集合 ${name} ✓`);
    } catch (e) {
      log.push(`集合 ${name} 已存在，跳过`);
    }
  }

  // 2. 灌商品（仅当 goods 为空，避免重复）
  const goodsCount = await db.collection('goods').count();
  if (goodsCount.total === 0) {
    let t = Date.now();
    for (const g of GOODS) {
      await db.collection('goods').add({ data: { ...g, createdAt: t++ } });
    }
    log.push(`灌入 ${GOODS.length} 个示例商品 ✓`);
  } else {
    log.push(`goods 已有 ${goodsCount.total} 条，跳过灌数据`);
  }

  // 3. 灌动态（仅当 updates 为空）
  const upCount = await db.collection('updates').count();
  if (upCount.total === 0) {
    let t = Date.now();
    for (const u of UPDATES) {
      await db.collection('updates').add({ data: { ...u, createdAt: t++ } });
    }
    log.push(`灌入 ${UPDATES.length} 条示例动态 ✓`);
  } else {
    log.push(`updates 已有 ${upCount.total} 条，跳过`);
  }

  // 3.5 灌轮播图（仅当 banners 为空）
  const bnCount = await db.collection('banners').count();
  if (bnCount.total === 0) {
    let t = Date.now();
    for (const b of BANNERS) {
      await db.collection('banners').add({ data: { ...b, createdAt: t++ } });
    }
    log.push(`灌入 ${BANNERS.length} 条示例轮播 ✓`);
  } else {
    log.push(`banners 已有 ${bnCount.total} 条，跳过`);
  }

  // 4. 首次引导设管理员：仅当系统"还没有任何管理员"时允许，且只认调用者本人 openid
  //    （防越权：杜绝任何人靠调 init 把自己/他人变管理员）
  if (event && event.makeMeStaff) {
    if (!OPENID) {
      log.push('云端测试无登录态，无法设管理员。请在小程序里用「员工入口」的动态口令。');
    } else {
      const adminCount = await db.collection('staff').where({ role: 'admin' }).count();
      if (adminCount.total > 0) {
        log.push('系统已有管理员，makeMeStaff 已禁用（防越权）。加管理员请用店铺管理 / 员工入口。');
      } else {
        const exist = await db.collection('staff').where({ openid: OPENID }).get();
        if (exist.data.length) {
          await db.collection('staff').doc(exist.data[0]._id).update({ data: { role: 'admin' } });
        } else {
          await db.collection('staff').add({
            data: { openid: OPENID, name: '店长', jobNo: 'D1001', role: 'admin', createdAt: Date.now() }
          });
        }
        log.push('首个管理员已设置 ✓');
      }
    }
  }

  return { ok: true, openid: OPENID, log };
};
