const app = getApp();

Page({
  data: { submitting: false },

  // 微信手机号一键登录：button open-type="getPhoneNumber" 触发
  async onGetPhone(e) {
    const code = e.detail && e.detail.code;
    if (!code) {
      // 用户拒绝授权或低版本基础库
      wx.showToast({ title: '已取消，需手机号才能使用', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    wx.showLoading({ title: '登录中', mask: true });
    try {
      const res = await wx.cloud.callFunction({ name: 'bindPhone', data: { code } });
      wx.hideLoading();
      this.setData({ submitting: false });
      const r = res.result || {};
      if (r.ok) {
        await app.refreshUser();
        wx.reLaunch({ url: '/pages/index/index' });
      } else {
        wx.showModal({ title: '登录失败', content: r.msg || '请重试', showCancel: false });
      }
    } catch (err) {
      wx.hideLoading();
      this.setData({ submitting: false });
      const msg = (err && (err.errMsg || err.message)) || '';
      if (msg.indexOf('not found') >= 0 || msg.indexOf('404') >= 0) {
        wx.showModal({ title: '云函数未部署', content: '请先右键 cloudfunctions/bindPhone → 上传并部署', showCancel: false });
      } else {
        wx.showModal({ title: '登录失败', content: msg || '网络异常', showCancel: false });
      }
    }
  },

  goRules() { wx.navigateTo({ url: '/pages/rules/rules' }); },
  goStaffLogin() { wx.navigateTo({ url: '/pages/staff-login/staff-login' }); }
});
