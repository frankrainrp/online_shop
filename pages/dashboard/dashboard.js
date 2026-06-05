const app = getApp();

const RANGES = [
  { key: 'today', name: '今日' },
  { key: '7d', name: '近7天' },
  { key: '30d', name: '近30天' }
];

Page({
  data: {
    checked: false,
    isAdmin: false,
    ranges: RANGES,
    range: 'today',
    loading: false,
    stats: null
  },

  async onShow() {
    const g = await app.getUser();
    this.setData({ isAdmin: g.isAdmin, checked: true });
    if (g.isAdmin) this.load();
  },

  switchRange(e) {
    this.setData({ range: e.currentTarget.dataset.r }, () => this.load());
  },

  async load() {
    this.setData({ loading: true });
    try {
      const res = await wx.cloud.callFunction({ name: 'getDashboard', data: { range: this.data.range } });
      const r = res.result || {};
      if (r.ok) {
        this.setData({ stats: r.stats, loading: false });
      } else {
        this.setData({ loading: false });
        wx.showToast({ title: r.msg || '加载失败', icon: 'none' });
      }
    } catch (e) {
      this.setData({ loading: false });
      const msg = (e && (e.errMsg || e.message)) || '';
      if (msg.indexOf('not found') >= 0 || msg.indexOf('404') >= 0) {
        wx.showModal({ title: '云函数未部署', content: '请先右键 cloudfunctions/getDashboard → 上传并部署', showCancel: false });
      } else {
        wx.showToast({ title: '网络异常', icon: 'none' });
      }
    }
  },

  onPullDownRefresh() {
    this.load();
    wx.stopPullDownRefresh();
  }
});
