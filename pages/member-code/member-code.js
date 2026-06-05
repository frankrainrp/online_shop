const app = getApp();
const { levelOf } = require('../../utils/format.js');

Page({
  data: {
    user: null,
    levelName: '普通会员',
    memberNo: ''   // 给店员看的会员号（= users._id）
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) this.getTabBar().setData({ selected: 2 });
    this.load();
  },

  async load() {
    const { userInfo } = await app.getUser();
    if (!userInfo) return;
    this.setData({
      user: userInfo,
      levelName: levelOf(userInfo.growth || 0).name,
      memberNo: userInfo._id
    });
    this.drawQR();
  },

  // 用 canvas 画"会员号"二维码占位（真正二维码见 README 接 weapp-qrcode）
  // 当前：店员可用 scanCode 或手输会员号加分，闭环已通
  drawQR() {
    // 预留：引入 weapp-qrcode 后在此把 this.data.memberNo 画成二维码
  },

  copyNo() {
    wx.setClipboardData({ data: this.data.memberNo, success: () => {
      wx.showToast({ title: '已复制会员号', icon: 'none' });
    }});
  },

  refresh() {
    app.refreshUser().then(() => this.load());
    wx.showToast({ title: '已刷新', icon: 'none' });
  }
});
