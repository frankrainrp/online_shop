const app = getApp();

// 动作筛选项（与云端写入的 action 文案一致）
const ACTIONS = ['全部', '加分', '扣分', '核销', '登录', '提权', '启用动态码', '重置动态码', '店员变更', '新增商品', '编辑商品', '删除商品', '新增轮播', '编辑轮播', '删除轮播', '新增动态', '编辑动态', '删除动态'];

Page({
  data: {
    checked: false,
    isAdmin: false,
    list: [],
    loading: false,
    hasMore: true,
    actions: ACTIONS,
    actionIdx: 0
  },

  async onShow() {
    const g = await app.getUser();
    this.setData({ isAdmin: g.isAdmin, checked: true });
    if (g.isAdmin && this.data.list.length === 0) this.reload();
  },

  onActionChange(e) {
    this.setData({ actionIdx: Number(e.detail.value) });
    this.reload();
  },

  reload() {
    this.setData({ list: [], hasMore: true });
    this.loadMore();
  },

  async loadMore() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });
    const action = this.data.actionIdx > 0 ? this.data.actions[this.data.actionIdx] : '';
    const last = this.data.list[this.data.list.length - 1];
    const data = { limit: 30 };
    if (action) data.action = action;
    if (last) data.beforeTs = last.ts;
    try {
      const res = await wx.cloud.callFunction({ name: 'getAudit', data });
      const r = res.result || {};
      if (r.ok) {
        const rows = (r.list || []).map(it => ({
          ...it,
          _time: this.fmtTime(it.ts)
        }));
        this.setData({
          list: this.data.list.concat(rows),
          hasMore: !!r.hasMore,
          loading: false
        });
      } else {
        this.setData({ loading: false, hasMore: false });
        wx.showToast({ title: r.msg || '加载失败', icon: 'none' });
      }
    } catch (e) {
      this.setData({ loading: false });
      const msg = (e && (e.errMsg || e.message)) || '';
      if (msg.indexOf('not found') >= 0 || msg.indexOf('404') >= 0) {
        wx.showModal({ title: '云函数未部署', content: '请先右键 cloudfunctions/getAudit → 上传并部署', showCancel: false });
      } else {
        wx.showToast({ title: '网络异常', icon: 'none' });
      }
    }
  },

  onReachBottom() { this.loadMore(); },

  fmtTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const p = n => String(n).padStart(2, '0');
    return `${d.getMonth() + 1}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
});
