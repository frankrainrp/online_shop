const app = getApp();

Page({
  data: {
    banners: [],   // 轮播图
    goods: [],     // 商品流
    loading: true
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) this.getTabBar().setData({ selected: 0 });
    this.load();
  },

  async load() {
    await app.getUser();
    const db = wx.cloud.database();
    try {
      // 轮播图（banners 集合，按 sort 升序）
      const bRes = await db.collection('banners').orderBy('sort', 'asc').limit(8).get()
        .catch(() => ({ data: [] }));
      // 商品流（goods 在售，按创建时间倒序）
      const gRes = await db.collection('goods')
        .where({ status: 'on' })
        .orderBy('createdAt', 'desc').limit(20).get()
        .catch(() => ({ data: [] }));
      this.setData({ banners: bRes.data, goods: gRes.data, loading: false });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  goRedeem() { wx.switchTab({ url: '/pages/redeem/redeem' }); },
  goCode()   { wx.switchTab({ url: '/pages/member-code/member-code' }); },
  goRedeems(){ wx.navigateTo({ url: '/pages/my-redeems/my-redeems' }); },
  goUpdates(){ wx.navigateTo({ url: '/pages/goods-update/goods-update' }); },
  goSearch() { wx.navigateTo({ url: '/pages/search/search' }); },

  // 点商品 → 商品详情页
  onGoods(e) {
    const id = e.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: `/pages/goods-detail/goods-detail?id=${id}` });
  },

  // 轮播点击（预留 link 跳转）
  onBanner(e) {
    const link = e.currentTarget.dataset.link;
    if (link) wx.navigateTo({ url: link, fail: () => {} });
  },

  // 每日签到
  async signIn() {
    wx.showLoading({ title: '签到中', mask: true });
    try {
      const res = await wx.cloud.callFunction({ name: 'signIn' });
      wx.hideLoading();
      if (res.result.ok) {
        await app.refreshUser();
        wx.showToast({ title: `签到 +${res.result.reward} 积分`, icon: 'success' });
      } else if (res.result.needLogin) {
        app.promptLogin('登录后才能签到领积分');
      } else {
        wx.showToast({ title: res.result.msg, icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '网络异常', icon: 'none' });
    }
  }
});
