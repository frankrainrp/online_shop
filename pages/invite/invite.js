const app = getApp();
const { POINT_RULES } = require('../../utils/config.js');
const REWARD = POINT_RULES.INVITE_REWARD;

Page({
  data: {
    user: null,
    inviteCount: 0,
    reward: REWARD,
    rewardYuan: Math.round(REWARD / POINT_RULES.POINT_TO_YUAN)
  },

  onShareAppMessage() {
    const u = this.data.user;
    const inviter = u ? u._id : '';
    return {
      title: '我在「是模玩店！」攒积分换好物，邀你一起，到店消费双方各得好礼～',
      path: `/pages/index/index?inviter=${inviter}`
    };
  },

  async onShow() {
    const { userInfo } = await app.getUser();
    if (!userInfo) return;
    this.setData({ user: userInfo, inviteCount: userInfo.inviteCount || 0 });
  },

  // 提示：分享按钮用 open-type="share" 触发，无需额外逻辑
  tip() {
    wx.showToast({ title: '点右下角「分享给好友」', icon: 'none' });
  }
});
