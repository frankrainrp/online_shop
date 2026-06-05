const app = getApp();
const { levelOf, nextLevel } = require('../../utils/format.js');

Page({
  data: {
    user: null,
    isStaff: false,
    isAdmin: false,
    levelName: '普通会员',
    next: null
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) this.getTabBar().setData({ selected: 3 });
    this.load();
  },

  async load() {
    const g = await app.getUser();
    const u = g.userInfo;
    if (!u) return;
    this.setData({
      user: u,
      isStaff: g.isStaff,
      isAdmin: g.isAdmin,
      levelName: levelOf(u.growth || 0).name,
      next: nextLevel(u.growth || 0)
    });
  },

  // 选头像：先上传到云存储，再把 fileID 存进资料（临时路径会失效，必须传云存储）
  async onChooseAvatar(e) {
    const tempPath = e.detail.avatarUrl;
    if (!tempPath) return;
    wx.showLoading({ title: '上传头像', mask: true });
    try {
      const oid = (app.globalData.openid || 'u') + '-' + Date.now();
      const up = await wx.cloud.uploadFile({ cloudPath: `avatar/${oid}.png`, filePath: tempPath });
      wx.hideLoading();
      this.saveProfile({ avatarUrl: up.fileID });
    } catch (err) {
      wx.hideLoading();
      console.error('头像上传失败', err);
      wx.showModal({ title: '头像上传失败', content: (err && err.errMsg) || JSON.stringify(err), showCancel: false });
    }
  },
  onNickInput(e) {
    const nickName = (e.detail.value || '').trim();
    if (!nickName) return;
    this.saveProfile({ nickName });
  },
  async saveProfile(patch) {
    if (!this.data.user) return;
    // 走云函数，服务端只允许改 nickName/avatarUrl（防前端篡改积分）
    try {
      const res = await wx.cloud.callFunction({ name: 'updateProfile', data: patch });
      if (res.result && res.result.ok) {
        // 以数据库为准回读，避免显示回退
        const g = await app.refreshUser();
        if (g && g.userInfo) this.setData({ user: g.userInfo, levelName: levelOf(g.userInfo.growth || 0).name });
        wx.showToast({ title: '已保存', icon: 'success' });
      } else {
        wx.showToast({ title: (res.result && res.result.msg) || '更新失败', icon: 'none' });
      }
    } catch (e) {
      console.error('updateProfile 调用失败', e);
      const msg = (e && e.errMsg) || '';
      if (msg.indexOf('not found') >= 0 || msg.indexOf('could not be found') >= 0) {
        wx.showToast({ title: 'updateProfile 未部署', icon: 'none' });
      } else {
        wx.showToast({ title: '网络异常', icon: 'none' });
      }
    }
  },

  goPoints()  { wx.navigateTo({ url: '/pages/points/points' }); },
  goLog()     { wx.navigateTo({ url: '/pages/points-log/points-log' }); },
  goRedeems() { wx.navigateTo({ url: '/pages/my-redeems/my-redeems' }); },
  goRedeem()  { wx.switchTab({ url: '/pages/redeem/redeem' }); },
  goCode()    { wx.switchTab({ url: '/pages/member-code/member-code' }); },
  goStaff()   { wx.navigateTo({ url: '/pages/staff/staff' }); },
  goAdmin()   { wx.navigateTo({ url: '/pages/admin/admin' }); },
  goStaffLogin() { wx.navigateTo({ url: '/pages/staff-login/staff-login' }); },
  goRules() { wx.navigateTo({ url: '/pages/rules/rules' }); },
  goInvite() { wx.navigateTo({ url: '/pages/invite/invite' }); },

  // 隐藏入口：2 秒内连点版本号 7 下 → 员工入口
  onSecretTap() {
    const now = Date.now();
    if (!this._taps || now - (this._lastTap || 0) > 2000) this._taps = 0;
    this._taps += 1;
    this._lastTap = now;
    if (this._taps >= 7) {
      this._taps = 0;
      wx.navigateTo({ url: '/pages/staff-login/staff-login' });
    }
  }
});
