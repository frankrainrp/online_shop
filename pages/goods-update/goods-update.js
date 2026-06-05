const { fmtDate } = require('../../utils/format.js');

Page({
  data: {
    tab: '全部',   // 全部/新品到货/活动预告/店铺公告
    tabs: ['全部', '新品到货', '活动预告', '店铺公告'],
    list: [],
    loading: true,
    detail: null   // 点击查看的动态详情
  },

  onShow() { this.load(); },

  async load() {
    const db = wx.cloud.database();
    // updates 集合：{ type, title, desc, image, createdAt }
    const res = await db.collection('updates')
      .orderBy('createdAt', 'desc').limit(30).get().catch(() => ({ data: [] }));
    const list = res.data.map(it => ({ ...it, dateStr: fmtDate(it.createdAt) }));
    this.setData({ list, loading: false });
  },

  setTab(e) { this.setData({ tab: e.currentTarget.dataset.t }); },

  // 点击动态卡片 → 弹层看完整详情
  openDetail(e) { this.setData({ detail: e.currentTarget.dataset.item }); },
  closeDetail() { this.setData({ detail: null }); },
  noop() {}
});
