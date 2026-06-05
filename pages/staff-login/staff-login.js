const app = getApp();

Page({
  data: {
    code: '',
    submitting: false,
    isStaff: false,
    isAdmin: false,
    roleText: ''
  },

  async onShow() {
    const g = await app.getUser();
    this.setData({
      isStaff: g.isStaff,
      isAdmin: g.isAdmin,
      roleText: g.isAdmin ? '管理员' : (g.isStaff ? '店员' : '')
    });
  },

  onInput(e) { this.setData({ code: e.detail.value }); },

  async onSubmit() {
    const code = this.data.code.trim();
    if (!code) { wx.showToast({ title: '请输入动态码', icon: 'none' }); return; }

    this.setData({ submitting: true });
    wx.showLoading({ title: '验证中', mask: true });
    try {
      const res = await wx.cloud.callFunction({ name: 'claimAdmin', data: { code } });
      wx.hideLoading();
      this.setData({ submitting: false });
      if (res.result && res.result.ok) {
        await app.refreshUser();
        await this.onShow();
        wx.showModal({
          title: '成功',
          content: res.result.msg + '，现在可在「我的」页进入店铺管理',
          showCancel: false
        });
      } else {
        const r = res.result || {};
        // 带上服务器时间，便于诊断时钟偏差
        const extra = r.serverTime ? `\n服务器时间：${r.serverTime}` : '';
        wx.showModal({ title: '验证失败', content: (r.msg || '验证失败') + extra, showCancel: false });
      }
    } catch (e) {
      wx.hideLoading();
      this.setData({ submitting: false });
      console.error('claimAdmin 调用失败：', e);
      const msg = (e && (e.errMsg || e.message)) || '';
      if (msg.indexOf('not found') >= 0 || msg.indexOf('could not be found') >= 0 || msg.indexOf('404') >= 0) {
        wx.showModal({ title: '云函数未部署', content: '请先右键 cloudfunctions/claimAdmin → 上传并部署', showCancel: false });
      } else {
        wx.showModal({ title: '调用失败', content: msg || '网络异常，请重试', showCancel: false });
      }
    }
  },

  // 退出员工/管理员身份
  async onResign() {
    const ok = await new Promise(r => wx.showModal({
      title: '退出员工身份',
      content: '退出后将失去店员/管理员权限，可用动态码重新认证。确认退出？',
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
  }
});
