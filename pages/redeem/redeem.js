const app = getApp();

Page({
  data: {
    user: null,
    cat: '全部',         // 全部/优惠券/周边/贴纸/盲盒
    cats: ['全部', '优惠券', '周边', '贴纸', '盲盒'],
    goods: [],
    loading: true
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) this.getTabBar().setData({ selected: 1 });
    this.load();
  },

  async load() {
    const { userInfo } = await app.getUser();
    const db = wx.cloud.database();
    const res = await db.collection('goods')
      .where({ status: 'on' })
      .orderBy('cost', 'asc')
      .get();
    this.setData({ user: userInfo, goods: res.data, loading: false });
  },

  setCat(e) { this.setData({ cat: e.currentTarget.dataset.c }); },

  goRecords() { wx.navigateTo({ url: '/pages/my-redeems/my-redeems' }); },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: `/pages/goods-detail/goods-detail?id=${id}` });
  },

  async onRedeem(e) {
    const item = e.currentTarget.dataset.item;
    if (!this.data.user) { wx.showToast({ title: '请稍候，正在登录', icon: 'none' }); return; }
    if (this.data.user.points < item.cost) { wx.showToast({ title: '积分不足', icon: 'none' }); return; }

    const ok = await new Promise(r => wx.showModal({
      title: '确认兑换',
      content: `用 ${item.cost} 积分兑换「${item.name}」？`,
      success: res => r(res.confirm)
    }));
    if (!ok) return;

    wx.showLoading({ title: '兑换中', mask: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'redeemGoods',
        data: { goodsId: item._id }
      });
      wx.hideLoading();
      if (res.result.ok) {
        await app.refreshUser();
        wx.showModal({
          title: '兑换成功',
          content: `兑换码：${res.result.code}\n请到「我的兑换」向店员出示核销`,
          confirmText: '查看券',
          success: m => { if (m.confirm) this.goRecords(); }
        });
        this.load();
      } else {
        wx.showToast({ title: res.result.msg || '兑换失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '网络异常', icon: 'none' });
    }
  }
});
