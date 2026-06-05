const app = getApp();

Page({
  data: {
    keyword: '',
    cat: '全部',
    cats: ['全部', '优惠券', '周边', '贴纸', '盲盒'],
    sort: 'default',          // default(最新) | asc(积分低→高) | desc(积分高→低)
    results: [],
    loading: false
  },

  onLoad() { this.doSearch(); },   // 进页面先展示全部在售

  onInput(e) { this.setData({ keyword: e.detail.value }); },
  clear() { this.setData({ keyword: '' }, () => this.doSearch()); },

  setCat(e) { this.setData({ cat: e.currentTarget.dataset.c }, () => this.doSearch()); },
  setSort(e) { this.setData({ sort: e.currentTarget.dataset.s }, () => this.doSearch()); },

  async doSearch() {
    const kw = this.data.keyword.trim();
    const db = wx.cloud.database();
    const _ = db.command;

    // 组合条件：在售 +（关键词）+（类别）
    const conds = [{ status: 'on' }];
    if (kw) {
      const reg = db.RegExp({ regexp: kw, options: 'i' });
      conds.push(_.or([{ name: reg }, { category: reg }]));
    }
    if (this.data.cat !== '全部') conds.push({ category: this.data.cat });

    let q = db.collection('goods').where(conds.length > 1 ? _.and(conds) : conds[0]);
    // 积分 filter（排序）
    if (this.data.sort === 'asc') q = q.orderBy('cost', 'asc');
    else if (this.data.sort === 'desc') q = q.orderBy('cost', 'desc');
    else q = q.orderBy('createdAt', 'desc');

    this.setData({ loading: true });
    try {
      const res = await q.limit(50).get();
      this.setData({ results: res.data, loading: false });
    } catch (e) {
      console.error('搜索失败', e);
      this.setData({ results: [], loading: false });
      wx.showToast({ title: '搜索失败', icon: 'none' });
    }
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: `/pages/goods-detail/goods-detail?id=${id}` });
  }
});
