// 云函数 admin —— 店铺后台 CRUD（仅 role==='admin' 可用）
// 入参: { action: 'list'|'save'|'remove', collection: 'goods'|'banners'|'updates', data, id }
const cloud = require('wx-server-sdk');
const crypto = require('crypto');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 生成店员个人 TOTP 密钥 + otpauth（供店长在后台给店员出码扫进验证器）
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Encode(buf) {
  let bits = '';
  for (const b of buf) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.substr(i, 5), 2)];
  return out;
}
function makeOtpauth(secret, name) {
  const label = encodeURIComponent('是模玩店:' + (name || '店员'));
  const issuer = encodeURIComponent('是模玩店');
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&period=30&digits=6&algorithm=SHA1`;
}

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
  const operator = staff.data[0];
  if (!(operator.sessionExpireAt && operator.sessionExpireAt > Date.now())) {
    return { ok: false, msg: '登录已过期，请到员工入口重新认证', expired: true };
  }

  // 审计：写操作统一记一笔（读操作 list 不记）
  const writeAudit = async (action, targetType, targetId, summary) => {
    try {
      await db.collection('audit_log').add({
        data: { ts: Date.now(), openid: OPENID, operatorName: operator.name || operator.jobNo || '', action, targetType, targetId: targetId || '', summary: summary || '' }
      });
    } catch (e) { /* 审计失败不阻断 */ }
  };

  const { action, collection, data = {}, id } = event;

  // ---- 店员管理（按会员号增删改，不走 SCHEMA）----
  if (action === 'staffList') {
    const res = await db.collection('staff').orderBy('createdAt', 'desc').get();
    const now = Date.now();
    // 脱敏：绝不把 totpSecret 回传客户端，只给「是否已启用 / 会话是否有效」
    const list = res.data.map(s => ({
      _id: s._id, openid: s.openid, name: s.name, jobNo: s.jobNo, role: s.role,
      hasSecret: !!s.totpSecret,
      sessionValid: !!(s.sessionExpireAt && s.sessionExpireAt > now),
      sessionExpireAt: s.sessionExpireAt || 0,
      createdAt: s.createdAt || 0
    }));
    return { ok: true, list };
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
      await writeAudit('店员变更', 'staff', exist.data[0]._id, `更新 ${u.data.nickName || '店员'} 角色为 ${role === 'admin' ? '管理员' : '店员'}`);
      return { ok: true, mode: 'update' };
    }
    const addStaff = await db.collection('staff').add({
      data: { openid: targetOpenid, name: u.data.nickName || '店员', jobNo: 'D' + String(Date.now()).slice(-4), role, createdAt: Date.now() }
    });
    await writeAudit('店员变更', 'staff', addStaff._id, `新增 ${u.data.nickName || '店员'}（${role === 'admin' ? '管理员' : '店员'}），请点「生成码」发放动态码`);
    return { ok: true, mode: 'create' };
  }
  if (action === 'staffRemove') {
    if (!id) return { ok: false, msg: '缺少 id' };
    if (staff.data[0]._id === id) return { ok: false, msg: '不能移除自己' };
    const victim = await db.collection('staff').doc(id).get().catch(() => null);
    await db.collection('staff').doc(id).remove();
    await writeAudit('店员变更', 'staff', id, `移除店员 ${(victim && victim.data && victim.data.name) || id}`);
    return { ok: true };
  }
  // 店长为某店员「生成/重置动态码密钥」：当场拿到 otpauth 给店员扫进验证器
  // 旧验证器立即失效、会话清零，店员需用新码重新登录
  if (action === 'staffGenSecret') {
    if (!id) return { ok: false, msg: '缺少 id' };
    const t = await db.collection('staff').doc(id).get().catch(() => null);
    if (!t || !t.data) return { ok: false, msg: '店员不存在' };
    const secret = base32Encode(crypto.randomBytes(20)); // 160 位
    await db.collection('staff').doc(id).update({ data: { totpSecret: secret, sessionExpireAt: 0 } });
    await writeAudit(t.data.totpSecret ? '重置动态码' : '启用动态码', 'staff', id, `为 ${t.data.name || id} 生成动态码密钥`);
    return { ok: true, secret, otpauth: makeOtpauth(secret, t.data.name), name: t.data.name || '店员' };
  }

  // ---- 商品/轮播/动态 通用 CRUD ----
  if (!SCHEMA[collection]) return { ok: false, msg: '不支持的集合' };
  const col = db.collection(collection);

  if (action === 'list') {
    const res = await col.orderBy('createdAt', 'desc').limit(100).get();
    return { ok: true, list: res.data };
  }

  const CN = { goods: '商品', banners: '轮播', updates: '动态' };

  if (action === 'save') {
    const clean = sanitize(collection, data);
    const name = clean.name || clean.title || '';
    if (data._id) {
      // 更新
      await col.doc(data._id).update({ data: clean });
      await writeAudit('编辑' + CN[collection], collection, data._id, `更新${CN[collection]}「${name}」`);
      return { ok: true, id: data._id, mode: 'update' };
    } else {
      // 新建（补默认值 + 创建时间）
      const doc = { ...SCHEMA[collection].defaults, ...clean, createdAt: Date.now() };
      const add = await col.add({ data: doc });
      await writeAudit('新增' + CN[collection], collection, add._id, `新增${CN[collection]}「${name}」`);
      return { ok: true, id: add._id, mode: 'create' };
    }
  }

  if (action === 'remove') {
    if (!id) return { ok: false, msg: '缺少 id' };
    const old = await col.doc(id).get().catch(() => null);
    const oldName = old && old.data ? (old.data.name || old.data.title || id) : id;
    await col.doc(id).remove();
    await writeAudit('删除' + CN[collection], collection, id, `删除${CN[collection]}「${oldName}」`);
    return { ok: true, id };
  }

  return { ok: false, msg: '未知 action' };
};
