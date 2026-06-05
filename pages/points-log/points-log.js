const app = getApp();
const { fmtDate } = require('../../utils/format.js');

Page({
  data: {
    list: [],
    filter: '全部',   // 全部 / 获取 / 消费
    loading: true
  },

  onShow() { this.load(); },

  async load() {
    const { userInfo } = await app.getUser();
    if (!userInfo) return;
    const db = wx.cloud.database();
    const res = await db.collection('points_log')
      .where({ userId: userInfo._id })
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    const list = res.data.map(it => ({
      ...it,
      dateStr: fmtDate(it.createdAt),
      sign: it.delta > 0 ? '+' : ''
    }));
    this.setData({ list, loading: false });
  },

  setFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.f });
  }
});
