const { fmtDate } = require('../../utils/format.js');

Page({
  data: {
    all: [],          // 全部记录
    shown: [],        // 当前筛选后展示的
    filter: '全部',   // 全部 / 获取 / 消费
    loading: true
  },

  onShow() { this.load(); },

  async load() {
    this.setData({ loading: true });
    try {
      // 走云函数读本人流水（不依赖客户端集合安全规则，认证前也能读）
      const res = await wx.cloud.callFunction({ name: 'getPointsLog', data: { limit: 100 } });
      const r = res.result || {};
      const all = (r.ok ? r.list : []).map(it => ({
        ...it,
        dateStr: fmtDate(it.createdAt),
        sign: it.delta > 0 ? '+' : ''
      }));
      this.setData({ all, loading: false }, () => this.applyFilter());
    } catch (e) {
      this.setData({ loading: false, all: [], shown: [] });
      const msg = (e && (e.errMsg || e.message)) || '';
      if (msg.indexOf('not found') >= 0 || msg.indexOf('404') >= 0) {
        wx.showModal({ title: '云函数未部署', content: '请先右键 cloudfunctions/getPointsLog → 上传并部署', showCancel: false });
      }
    }
  },

  setFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.f }, () => this.applyFilter());
  },

  applyFilter() {
    const f = this.data.filter;
    const shown = this.data.all.filter(it =>
      f === '全部' || (f === '获取' && it.delta > 0) || (f === '消费' && it.delta < 0)
    );
    this.setData({ shown });
  }
});
