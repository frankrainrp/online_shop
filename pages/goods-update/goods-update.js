const { fmtDate } = require('../../utils/format.js');

Page({
  data: {
    tab: '全部',   // 全部/新品到货/活动预告/店铺公告
    tabs: ['全部', '新品到货', '活动预告', '店铺公告'],
    list: [],
    loading: true
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

  setTab(e) { this.setData({ tab: e.currentTarget.dataset.t }); }
});
