// 云函数 admin —— 店铺后台 CRUD（仅 role==='admin' 可用）
// 入参: { action: 'list'|'save'|'remove', collection: 'goods'|'banners'|'updates', data, id }
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 允许管理的集合 + 各自字段白名单（杜绝注入任意字段）
const SCHEMA = {
  goods: {
    fields: { name: 'string', category: 'string', cost: 'number', stock: 'number', image: 'string', images: 'images', status: 'string', desc: 'string' },
    defaults: { status: 'on', stock: 0, cost: 0, image: '', images: [], desc: '' }
  },
  banners: {
    fields: { title: 'string', image: 'string', link: 'string', sort: 'number' },
    defaults: { link: '', sort: 99, image: '' }
  },
  updates: {
    fields: { type: 'string', title: 'string', desc: 'string', image: 'string' },
    defaults: { image: '' }
  }
};

// 按白名单+类型清洗入参
function sanitize(collection, raw) {
  const { fields } = SCHEMA[collection];
  const out = {};
  for (const k in fields) {
    if (raw[k] === undefined || raw[k] === null) continue;
    if (fields[k] === 'number') {
      let n = Math.floor(Number(raw[k]));
      if (isNaN(n) || n < 0) n = 0;          // 非负整数，杜绝负库存/负积分价/小数
      if (n > 1e9) n = 1e9;                  // 上限钳制，杜绝超大值
      out[k] = n;
    } else if (fields[k] === 'images') {
      // 图片数组：每项必须是 cloud:// 或 https:// 字符串，最多 9 张
      const arr = Array.isArray(raw[k]) ? raw[k] : [];
      out[k] = arr.filter(s => typeof s === 'string' && /^(cloud:\/\/|https:\/\/)/.test(s)).slice(0, 9);
    } else {
      out[k] = String(raw[k]).slice(0, 500);
    }
  }
  // 商品：封面 image 自动取第一张，保证列表卡片有图
  if (collection === 'goods' && Array.isArray(out.images)) {
    out.image = out.images[0] || '';
  }
  return out;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();

  // 鉴权：必须是 admin
  const staff = await db.collection('staff').where({ openid: OPENID }).get();
  if (!staff.data.length || staff.data[0].role !== 'admin') {
    return { ok: false, msg: '无权限：仅管理员可操作' };
  }

  const { action, collection, data = {}, id } = event;

  // ---- 店员管理（按会员号增删改，不走 SCHEMA）----
  if (action === 'staffList') {
    const res = await db.collection('staff').orderBy('createdAt', 'desc').get();
    return { ok: true, list: res.data };
  }
  if (action === 'staffSave') {
    const memberNo = data.memberNo;
    if (!memberNo) return { ok: false, msg: '请输入会员号' };
    const role = data.role === 'admin' ? 'admin' : 'staff';
    // 按会员号(=users._id)查目标会员，拿其 openid
    const u = await db.collection('users').doc(memberNo).get().catch(() => null);
    if (!u || !u.data) return { ok: false, msg: '会员不存在，请核对会员号' };
    const targetOpenid = u.data.openid;
    const exist = await db.collection('staff').where({ openid: targetOpenid }).get();
    if (exist.data.length) {
      await db.collection('staff').doc(exist.data[0]._id).update({ data: { role, name: u.data.nickName || '店员' } });
      return { ok: true, mode: 'update' };
    }
    await db.collection('staff').add({
      data: { openid: targetOpenid, name: u.data.nickName || '店员', jobNo: 'D' + String(Date.now()).slice(-4), role, createdAt: Date.now() }
    });
    return { ok: true, mode: 'create' };
  }
  if (action === 'staffRemove') {
    if (!id) return { ok: false, msg: '缺少 id' };
    if (staff.data[0]._id === id) return { ok: false, msg: '不能移除自己' };
    await db.collection('staff').doc(id).remove();
    return { ok: true };
  }

  // ---- 商品/轮播/动态 通用 CRUD ----
  if (!SCHEMA[collection]) return { ok: false, msg: '不支持的集合' };
  const col = db.collection(collection);

  if (action === 'list') {
    const res = await col.orderBy('createdAt', 'desc').limit(100).get();
    return { ok: true, list: res.data };
  }

  if (action === 'save') {
    const clean = sanitize(collection, data);
    if (data._id) {
      // 更新
      await col.doc(data._id).update({ data: clean });
      return { ok: true, id: data._id, mode: 'update' };
    } else {
      // 新建（补默认值 + 创建时间）
      const doc = { ...SCHEMA[collection].defaults, ...clean, createdAt: Date.now() };
      const add = await col.add({ data: doc });
      return { ok: true, id: add._id, mode: 'create' };
    }
  }

  if (action === 'remove') {
    if (!id) return { ok: false, msg: '缺少 id' };
    await col.doc(id).remove();
    return { ok: true, id };
  }

  return { ok: false, msg: '未知 action' };
};
