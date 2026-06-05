const app = getApp();
const { levelOf } = require('../../utils/format.js');
const { drawQrcode } = require('../../utils/qrcode.js');

Page({
  data: {
    user: null,
    levelName: '普通会员',
    memberNo: '',     // 给店员看的会员号（= users._id），同时是二维码内容
    qrPx: 220,        // 二维码画布边长（px，按屏幕宽度换算）
    qrReady: false
  },

  onLoad() {
    // 把 360rpx 画布换算成 px（旧版 canvas 绘制坐标用 px，须与布局尺寸一致）
    try {
      const info = wx.getSystemInfoSync();
      const px = Math.round((360 / 750) * info.windowWidth);
      this.setData({ qrPx: px });
    } catch (e) { /* 用默认 220 */ }
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

  // 用纯 JS QR 编码器把会员号画成真二维码（店员可直接 wx.scanCode 扫）
  drawQR() {
    const no = this.data.memberNo;
    if (!no) return;
    drawQrcode({
      canvasId: 'qrcanvas',
      ctxScope: this,
      text: no,
      width: this.data.qrPx,
      height: this.data.qrPx,
      dark: '#151515',
      light: '#ffffff',
      callback: () => this.setData({ qrReady: true })
    });
  },

  refresh() {
    app.refreshUser().then(() => this.load());
    wx.showToast({ title: '已刷新', icon: 'none' });
  }
});
