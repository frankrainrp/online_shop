const app = getApp();
const { fmtDate } = require('../../utils/format.js');

Page({
  data: {
    list: [],
    filter: '全部',  // 全部/待核销/已完成/已取消
    filters: ['全部', '待核销', '已完成', '已取消'],
    loading: true
  },

  onShow() { this.load(); },

  async load() {
    const { userInfo } = await app.getUser();
    if (!userInfo) return;
    const db = wx.cloud.database();
    const res = await db.collection('redeems')
      .where({ userId: userInfo._id })
      .orderBy('createdAt', 'desc')
      .get();
    const STATUS_CLASS = { '待核销': 'pending', '已完成': 'done', '已取消': 'canceled' };
    const list = res.data.map(it => ({
      ...it,
      dateStr: fmtDate(it.createdAt),
      statusClass: STATUS_CLASS[it.status] || 'pending'
    }));
    this.setData({ list, loading: false });
  },

  setFilter(e) { this.setData({ filter: e.currentTarget.dataset.f }); },

  showCode(e) {
    const item = e.currentTarget.dataset.item;
    wx.showModal({
      title: '兑换码',
      content: item.code + '\n请向店员出示此码核销',
      showCancel: false
    });
  }
});
