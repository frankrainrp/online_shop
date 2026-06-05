const app = getApp();
const { drawQrcode } = require('../../utils/qrcode.js');

Page({
  data: {
    code: '',
    submitting: false,
    // 身份/会话
    isStaff: false,        // 会话有效（已登录店员）
    isAdmin: false,
    roleText: '',
    expireText: '',        // 距到期描述
    // 流程状态：loading / loggedIn / needEnroll / login / bootstrap
    mode: 'loading',
    // 启用密钥（仅生成那一刻可见，用完即弃）
    enroll: null,          // { otpauth, secret }
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
    const st = g.staffState;
    let mode = 'bootstrap';
    if (g.isStaff) mode = 'loggedIn';
    else if (st && st.exists && !st.hasSecret) mode = 'needEnroll';
    else if (st && st.exists && st.hasSecret) mode = 'login';

    this.setData({
      isStaff: g.isStaff,
      isAdmin: g.isAdmin,
      roleText: g.isAdmin ? '管理员' : (g.isStaff ? '店员' : ''),
      expireText: this.fmtExpire(st && st.sessionExpireAt),
      mode
    });
  },

  fmtExpire(ts) {
    if (!ts) return '';
    const left = ts - Date.now();
    if (left <= 0) return '已过期';
    const d = Math.floor(left / 86400000);
    const h = Math.floor((left % 86400000) / 3600000);
    return d > 0 ? `约 ${d} 天 ${h} 小时后到期` : `约 ${h} 小时后到期`;
  },

  onInput(e) { this.setData({ code: e.detail.value }); },

  // 动态码登录（个人密钥 / 主口令引导，由云函数按是否有 staff 记录决定）
  async onSubmit() {
    const code = this.data.code.trim();
    if (!code) { wx.showToast({ title: '请输入动态码', icon: 'none' }); return; }

    this.setData({ submitting: true });
    wx.showLoading({ title: '验证中', mask: true });
    try {
      const res = await wx.cloud.callFunction({ name: 'claimAdmin', data: { code } });
      wx.hideLoading();
      this.setData({ submitting: false });
      const r = res.result || {};
      if (r.ok) {
        this.setData({ code: '' });
        await app.refreshUser();
        // 主口令引导首次会返回个人密钥，引导扫进验证器
        if (r.enroll) {
          this.showEnroll(r.enroll);
          wx.showModal({ title: r.msg || '已登录', content: '请把下方密钥扫进验证器 App，以后用个人动态码登录。', showCancel: false });
        } else {
          wx.showToast({ title: r.msg || '登录成功', icon: 'success' });
        }
        await this.onShow();
      } else if (r.needEnroll) {
        await this.onShow(); // 切到 needEnroll
        wx.showModal({ title: '请先启用', content: '你已被加为店员，请先点「启用我的动态码」生成密钥。', showCancel: false });
      } else {
        const extra = r.serverTime ? `\n服务器时间：${r.serverTime}` : '';
        wx.showModal({ title: '验证失败', content: (r.msg || '验证失败') + extra, showCancel: false });
      }
    } catch (e) {
      wx.hideLoading();
      this.setData({ submitting: false });
      this.handleCallErr(e, 'claimAdmin');
    }
  },

  // 首次启用 / 换设备重置：生成个人密钥
  async onEnroll(e) {
    const reset = !!(e && e.currentTarget && e.currentTarget.dataset.reset);
    if (reset) {
      const ok = await new Promise(r => wx.showModal({
        title: '重置动态码', content: '重置后旧验证器立即失效，需重新扫码并登录。确认重置？',
        success: m => r(m.confirm)
      }));
      if (!ok) return;
    }
    wx.showLoading({ title: '生成中', mask: true });
    try {
      const res = await wx.cloud.callFunction({ name: 'staffSecret', data: reset ? { reset: true } : {} });
      wx.hideLoading();
      const r = res.result || {};
      if (r.ok) {
        this.showEnroll(r);
        await app.refreshUser();
        await this.onShow();
      } else {
        wx.showToast({ title: r.msg || '生成失败', icon: 'none' });
      }
    } catch (e2) {
      wx.hideLoading();
      this.handleCallErr(e2, 'staffSecret');
    }
  },

  // 展示启用二维码（otpauth）+ 手动密钥
  showEnroll(enroll) {
    this.setData({ enroll: { otpauth: enroll.otpauth, secret: enroll.secret } });
    setTimeout(() => {
      drawQrcode({
        canvasId: 'enrollqr', ctxScope: this,
        text: enroll.otpauth, width: this.data.qrPx, height: this.data.qrPx,
        dark: '#151515', light: '#ffffff'
      });
    }, 60);
  },

  copySecret() {
    if (!this.data.enroll) return;
    wx.setClipboardData({ data: this.data.enroll.secret, success: () => wx.showToast({ title: '密钥已复制', icon: 'none' }) });
  },

  goAdmin() { wx.navigateTo({ url: '/pages/admin/admin' }); },
  goStaff() { wx.navigateTo({ url: '/pages/staff/staff' }); },
  goAudit() { wx.navigateTo({ url: '/pages/audit/audit' }); },

  // 退出员工/管理员身份
  async onResign() {
    const ok = await new Promise(r => wx.showModal({
      title: '退出员工身份',
      content: '退出后将失去店员/管理员权限。确认退出？',
      success: m => r(m.confirm)
    }));
    if (!ok) return;
    wx.showLoading({ title: '处理中', mask: true });
    try {
      const res = await wx.cloud.callFunction({ name: 'resignStaff' });
      wx.hideLoading();
      if (res.result && res.result.ok) {
        await app.refreshUser();
        await this.onShow();
        wx.showToast({ title: res.result.msg || '已退出', icon: 'none' });
      } else {
        wx.showToast({ title: '退出失败', icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '网络异常', icon: 'none' });
    }
  },

  handleCallErr(e, fnName) {
    console.error(fnName + ' 调用失败：', e);
    const msg = (e && (e.errMsg || e.message)) || '';
    if (msg.indexOf('not found') >= 0 || msg.indexOf('could not be found') >= 0 || msg.indexOf('404') >= 0) {
      wx.showModal({ title: '云函数未部署', content: `请先右键 cloudfunctions/${fnName} → 上传并部署`, showCancel: false });
    } else {
      wx.showModal({ title: '调用失败', content: msg || '网络异常，请重试', showCancel: false });
    }
  }
});
