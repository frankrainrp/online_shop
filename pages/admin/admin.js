const app = getApp();
const { drawQrcode } = require('../../utils/qrcode.js');

// 各资源的表单字段配置
const FORM = {
  goods: [
    { key: 'name', label: '商品名称', type: 'text' },
    { key: 'category', label: '分类', type: 'picker', options: ['优惠券', '周边', '贴纸', '盲盒'] },
    { key: 'cost', label: '所需积分', type: 'number' },
    { key: 'stock', label: '库存', type: 'number' },
    { key: 'desc', label: '商品描述', type: 'textarea' },
    { key: 'status', label: '上架', type: 'switch' },
    { key: 'images', label: '商品图（可多张，第一张为封面）', type: 'images' }
  ],
  banners: [
    { key: 'title', label: '标题', type: 'text' },
    { key: 'sort', label: '排序(小在前)', type: 'number' },
    { key: 'link', label: '跳转链接(选填)', type: 'text' },
    { key: 'image', label: '轮播图', type: 'image' }
  ],
  updates: [
    { key: 'type', label: '类型', type: 'picker', options: ['新品到货', '活动预告', '店铺公告'] },
    { key: 'title', label: '标题', type: 'text' },
    { key: 'desc', label: '描述', type: 'textarea' },
    { key: 'image', label: '配图', type: 'image' }
  ],
  staff: [
    { key: 'memberNo', label: '会员号（让对方在"会员码"页查看复制）', type: 'text' },
    { key: 'role', label: '设为管理员（关=普通店员）', type: 'switch' }
  ]
};

const TABS = [
  { key: 'goods', name: '商品' },
  { key: 'banners', name: '轮播' },
  { key: 'updates', name: '动态' },
  { key: 'staff', name: '店员' }
];

Page({
  data: {
    checked: false,
    isAdmin: false,
    tabs: TABS,
    tab: 'goods',
    list: [],
    formFields: FORM.goods,
    showForm: false,
    form: {},        // 当前编辑对象
    saving: false,
    secretModal: null, // 店员动态码二维码弹层 { name, secret, otpauth }
    qrPx: 220
  },

  onLoad() {
    try {
      const info = wx.getSystemInfoSync();
      this.setData({ qrPx: Math.round((400 / 750) * info.windowWidth) });
    } catch (e) { /* 默认 220 */ }
  },

  async onShow() {
    const g = await app.getUser();
    this.setData({ isAdmin: g.isAdmin, checked: true });
    if (g.isAdmin) this.loadList();
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ tab, formFields: FORM[tab], showForm: false }, () => this.loadList());
  },

  async loadList() {
    const tab = this.data.tab;
    const action = tab === 'staff' ? 'staffList' : 'list';
    wx.showLoading({ title: '加载中' });
    try {
      const res = await wx.cloud.callFunction({ name: 'admin', data: { action, collection: tab } });
      wx.hideLoading();
      const raw = (res.result && res.result.list) || [];
      const list = raw.map(it => {
        let title = '', sub = '';
        if (tab === 'goods') { title = it.name; sub = `${it.cost}积分 · 库存${it.stock} · ${it.status === 'on' ? '已上架' : '已下架'}`; }
        else if (tab === 'banners') { title = it.title || '(无标题)'; sub = `排序 ${it.sort}`; }
        else if (tab === 'staff') {
          title = it.name || it.openid;
          const codeState = it.hasSecret ? (it.sessionValid ? '已登录' : '已启用动态码') : '未启用动态码';
          sub = `${it.role === 'admin' ? '管理员' : '店员'} · 工号${it.jobNo || '-'} · ${codeState}`;
        }
        else { title = it.title; sub = it.type; }
        return { ...it, _title: title, _sub: sub, _img: it.image || '' };
      });
      this.setData({ list });
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  // 新增
  onAdd() {
    const blank = {};
    this.data.formFields.forEach(f => {
      if (f.type === 'switch') blank[f.key] = f.key === 'role' ? 'off' : 'on'; // 店员角色默认普通店员
      else if (f.type === 'images') blank[f.key] = [];
      else blank[f.key] = f.type === 'number' ? 0 : '';
    });
    this.setData({ form: blank, showForm: true });
  },

  // 编辑
  onEdit(e) {
    const item = e.currentTarget.dataset.item;
    const form = { ...item };
    // 兼容旧数据：没有 images 数组时，用单图 image 兜底
    if (this.data.formFields.some(f => f.type === 'images')) {
      form.images = Array.isArray(item.images) ? item.images : (item.image ? [item.image] : []);
    }
    this.setData({ form, showForm: true });
  },

  closeForm() { this.setData({ showForm: false }); },
  noop() {},

  onInput(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ [`form.${key}`]: e.detail.value });
  },

  onPicker(e) {
    const key = e.currentTarget.dataset.key;
    const idx = e.detail.value;
    const opts = this.data.formFields.find(f => f.key === key).options;
    this.setData({ [`form.${key}`]: opts[idx] });
  },

  onSwitch(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ [`form.${key}`]: e.detail.value ? 'on' : 'off' });
  },

  // 上传图片到云存储
  async onChooseImage(e) {
    const key = e.currentTarget.dataset.key;
    // 1) 选图：取消则静默返回
    let tempPath;
    try {
      const r = await wx.chooseMedia({ count: 1, mediaType: ['image'], sizeType: ['compressed'] });
      tempPath = r.tempFiles && r.tempFiles[0] && r.tempFiles[0].tempFilePath;
    } catch (_) { return; }
    if (!tempPath) return;
    // 2) 上传：失败把真实错误弹出来，别再笼统报"已取消"
    wx.showLoading({ title: '上传中', mask: true });
    try {
      const cloudPath = `${this.data.tab}/${Date.now()}-${Math.floor(Math.random() * 1000)}.png`;
      const up = await wx.cloud.uploadFile({ cloudPath, filePath: tempPath });
      wx.hideLoading();
      this.setData({ [`form.${key}`]: up.fileID });
      wx.showToast({ title: '图片已上传', icon: 'success' });
    } catch (err) {
      wx.hideLoading();
      console.error('uploadFile 失败', err);
      wx.showModal({ title: '图片上传失败', content: (err && err.errMsg) || JSON.stringify(err), showCancel: false });
    }
  },

  // 多图上传（商品图）：一次可选多张，逐张传云存储，追加到 form.images
  async onChooseImages(e) {
    const key = e.currentTarget.dataset.key;
    const cur = (this.data.form[key] || []).slice();
    const remain = 9 - cur.length;
    if (remain <= 0) { wx.showToast({ title: '最多 9 张', icon: 'none' }); return; }
    let files;
    try {
      const r = await wx.chooseMedia({ count: remain, mediaType: ['image'], sizeType: ['compressed'] });
      files = (r.tempFiles || []).map(f => f.tempFilePath).filter(Boolean);
    } catch (_) { return; }
    if (!files.length) return;
    wx.showLoading({ title: `上传 0/${files.length}`, mask: true });
    try {
      for (let i = 0; i < files.length; i++) {
        wx.showLoading({ title: `上传 ${i + 1}/${files.length}`, mask: true });
        const cloudPath = `goods/${Date.now()}-${Math.floor(Math.random() * 10000)}.png`;
        const up = await wx.cloud.uploadFile({ cloudPath, filePath: files[i] });
        cur.push(up.fileID);
      }
      wx.hideLoading();
      this.setData({ [`form.${key}`]: cur });
      wx.showToast({ title: '已上传', icon: 'success' });
    } catch (err) {
      wx.hideLoading();
      this.setData({ [`form.${key}`]: cur }); // 已成功的先保留
      wx.showModal({ title: '部分图片上传失败', content: (err && err.errMsg) || JSON.stringify(err), showCancel: false });
    }
  },

  onRemoveImage(e) {
    const { key, index } = e.currentTarget.dataset;
    const arr = (this.data.form[key] || []).slice();
    arr.splice(index, 1);
    this.setData({ [`form.${key}`]: arr });
  },

  async onSave() {
    const tab = this.data.tab;
    const f = this.data.form;
    // 简单必填校验
    if (tab === 'goods' && !f.name) { wx.showToast({ title: '请填商品名', icon: 'none' }); return; }
    if (tab === 'updates' && !f.title) { wx.showToast({ title: '请填标题', icon: 'none' }); return; }
    if (tab === 'staff' && !f.memberNo) { wx.showToast({ title: '请输入会员号', icon: 'none' }); return; }

    // 店员保存：转成 staffSave 入参
    let action = 'save';
    let payload = f;
    if (tab === 'staff') {
      action = 'staffSave';
      payload = { memberNo: f.memberNo, role: f.role === 'on' ? 'admin' : 'staff' };
    }

    this.setData({ saving: true });
    wx.showLoading({ title: '保存中', mask: true });
    try {
      const res = await wx.cloud.callFunction({ name: 'admin', data: { action, collection: tab, data: payload } });
      wx.hideLoading();
      this.setData({ saving: false });
      if (res.result && res.result.ok) {
        wx.showToast({ title: '已保存', icon: 'success' });
        this.setData({ showForm: false });
        this.loadList();
      } else {
        wx.showToast({ title: (res.result && res.result.msg) || '保存失败', icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      this.setData({ saving: false });
      wx.showToast({ title: '网络异常', icon: 'none' });
    }
  },

  // 店长为店员生成/重置动态码密钥 → 弹二维码让店员当场扫进验证器
  async onGenSecret(e) {
    const item = e.currentTarget.dataset.item;
    const reset = !!item.hasSecret;
    const ok = await new Promise(r => wx.showModal({
      title: reset ? '重置动态码' : '生成动态码',
      content: reset
        ? `将为「${item.name || '该店员'}」生成新密钥，旧验证器立即失效，需重新扫码登录。继续？`
        : `为「${item.name || '该店员'}」生成动态码密钥，生成后让其用验证器扫码。继续？`,
      success: m => r(m.confirm)
    }));
    if (!ok) return;
    wx.showLoading({ title: '生成中', mask: true });
    try {
      const res = await wx.cloud.callFunction({ name: 'admin', data: { action: 'staffGenSecret', collection: 'staff', id: item._id } });
      wx.hideLoading();
      const r = res.result || {};
      if (r.ok) {
        this.setData({ secretModal: { name: r.name, secret: r.secret, otpauth: r.otpauth } });
        setTimeout(() => {
          drawQrcode({ canvasId: 'staffqr', ctxScope: this, text: r.otpauth, width: this.data.qrPx, height: this.data.qrPx, dark: '#151515', light: '#ffffff' });
        }, 60);
        this.loadList();
      } else {
        wx.showToast({ title: r.msg || '生成失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '网络异常', icon: 'none' });
    }
  },

  closeSecretModal() { this.setData({ secretModal: null }); },

  copyStaffSecret() {
    if (!this.data.secretModal) return;
    wx.setClipboardData({ data: this.data.secretModal.secret, success: () => wx.showToast({ title: '密钥已复制', icon: 'none' }) });
  },

  async onRemove(e) {
    const id = e.currentTarget.dataset.id;
    const ok = await new Promise(r => wx.showModal({ title: '确认删除', content: '删除后不可恢复', success: m => r(m.confirm) }));
    if (!ok) return;
    wx.showLoading({ title: '删除中', mask: true });
    try {
      const action = this.data.tab === 'staff' ? 'staffRemove' : 'remove';
      const res = await wx.cloud.callFunction({ name: 'admin', data: { action, collection: this.data.tab, id } });
      wx.hideLoading();
      if (res.result && res.result.ok) { wx.showToast({ title: '已删除', icon: 'none' }); this.loadList(); }
      else wx.showToast({ title: (res.result && res.result.msg) || '删除失败', icon: 'none' });
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '网络异常', icon: 'none' });
    }
  }
});
