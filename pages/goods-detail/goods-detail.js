const app = getApp();

Page({
  data: {
    id: '',
    goods: null,
    user: null,
    loading: true,
    canRedeem: false
  },

  onLoad(opt) {
    this.setData({ id: (opt && opt.id) || '' });
  },

  onShow() { this.load(); },

  async load() {
    const { userInfo } = await app.getUser();
    if (!this.data.id) { this.setData({ loading: false }); return; }
    try {
      const db = wx.cloud.database();
      const res = await db.collection('goods').doc(this.data.id).get();
      const goods = res.data;
      const imgs = (Array.isArray(goods.images) && goods.images.length)
        ? goods.images
        : (goods.image ? [goods.image] : []);
      this.setData({
        goods,
        imgs,
        user: userInfo,
        loading: false,
        canRedeem: !!(userInfo && goods.status === 'on' && goods.stock > 0 && userInfo.points >= goods.cost)
      });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '商品不存在', icon: 'none' });
    }
  },

  async onRedeem() {
    const g = this.data.goods;
    if (!g) return;
    if (!this.data.user || this.data.user.points < g.cost) { wx.showToast({ title: '积分不足', icon: 'none' }); return; }
    if (g.stock <= 0) { wx.showToast({ title: '已兑完', icon: 'none' }); return; }

    const ok = await new Promise(r => wx.showModal({
      title: '确认兑换',
      content: `用 ${g.cost} 积分兑换「${g.name}」？\n积分立即扣除，券需到店核销，成功后不退不换。`,
      success: m => r(m.confirm)
    }));
    if (!ok) return;

    wx.showLoading({ title: '兑换中', mask: true });
    try {
      const res = await wx.cloud.callFunction({ name: 'redeemGoods', data: { goodsId: this.data.id } });
      wx.hideLoading();
      if (res.result && res.result.ok) {
        await app.refreshUser();
        this.load();
        wx.showModal({
          title: '兑换成功',
          content: `兑换码：${res.result.code}\n请到「我的兑换」向店员出示核销`,
          confirmText: '查看券',
          success: m => { if (m.confirm) wx.navigateTo({ url: '/pages/my-redeems/my-redeems' }); }
        });
      } else {
        wx.showToast({ title: (res.result && res.result.msg) || '兑换失败', icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '网络异常', icon: 'none' });
    }
  }
});
