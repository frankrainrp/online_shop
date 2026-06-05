const app = getApp();
const { levelOf, nextLevel } = require('../../utils/format.js');

Page({
  data: {
    user: null,
    levelName: '普通会员',
    next: null,        // 下一等级
    needGrowth: 0      // 还差多少成长值
  },

  onShow() { this.load(); },

  async load() {
    const { userInfo } = await app.getUser();
    if (!userInfo) return;
    const growth = userInfo.growth || 0;
    const next = nextLevel(growth);
    this.setData({
      user: userInfo,
      levelName: levelOf(growth).name,
      next,
      needGrowth: next ? next.min - growth : 0
    });
  },

  goLog() { wx.navigateTo({ url: '/pages/points-log/points-log' }); },
  goRedeem() { wx.switchTab({ url: '/pages/redeem/redeem' }); },
  goCode() { wx.switchTab({ url: '/pages/member-code/member-code' }); },
  goRules() { wx.navigateTo({ url: '/pages/rules/rules' }); }
});
