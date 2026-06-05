const app = getApp();

Page({
  data: {
    isStaff: false,
    checked: false,
    memberNo: '',       // 输入/扫码得到的会员号
    member: null,       // 查到的会员
    amount: '',         // 加扣分数额
    redeemCode: '',     // 核销码
    recent: []          // 最近操作（本机会话内）
  },

  async onShow() {
    const g = await app.getUser();
    this.setData({ isStaff: g.isStaff, checked: true });
  },

  onMemberInput(e) { this.setData({ memberNo: e.detail.value }); },
  onAmountInput(e) { this.setData({ amount: e.detail.value }); },
  onCodeInput(e)   { this.setData({ redeemCode: e.detail.value }); },

  // 扫会员码（会员页二维码内容 = 会员号）
  scanMember() {
    wx.scanCode({
      success: res => {
        this.setData({ memberNo: res.result });
        this.queryMember();
      },
      fail: () => wx.showToast({ title: '已取消', icon: 'none' })
    });
  },

  // 查询会员（走云函数，服务端验店员身份；前端不直接读 users）
  async queryMember() {
    const id = this.data.memberNo.trim();
    if (!id) { wx.showToast({ title: '请输入会员号', icon: 'none' }); return; }
    wx.showLoading({ title: '查询中' });
    try {
      const res = await wx.cloud.callFunction({ name: 'getMember', data: { memberNo: id } });
      wx.hideLoading();
      if (res.result && res.result.ok) {
        this.setData({ member: res.result.member });
      } else {
        this.setData({ member: null });
        wx.showToast({ title: (res.result && res.result.msg) || '会员不存在', icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      this.setData({ member: null });
      wx.showToast({ title: '网络异常', icon: 'none' });
    }
  },

  addPoints(e) { this.changePoints(1); },
  subPoints(e) { this.changePoints(-1); },

  async changePoints(sign) {
    if (!this.data.member) { wx.showToast({ title: '请先查询会员', icon: 'none' }); return; }
    const val = parseInt(this.data.amount, 10);
    if (!val || val <= 0) { wx.showToast({ title: '请输入正确分值', icon: 'none' }); return; }
    const delta = val * sign;

    wx.showLoading({ title: '处理中', mask: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'addPoints',
        data: {
          targetUserId: this.data.member._id,
          delta,
          type: sign > 0 ? '消费' : '店员调整',
          remark: ''
        }
      });
      wx.hideLoading();
      if (res.result.ok) {
        const rec = `${this.data.member.nickName} ${delta>0?'+':''}${delta}分 → 余 ${res.result.balance}`;
        this.setData({
          'member.points': res.result.balance,
          amount: '',
          recent: [{ t: Date.now(), text: rec }, ...this.data.recent].slice(0, 10)
        });
        wx.showToast({ title: '操作成功', icon: 'success' });
      } else {
        wx.showToast({ title: res.result.msg, icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '网络异常', icon: 'none' });
    }
  },

  // 核销兑换码
  scanRedeem() {
    wx.scanCode({
      success: res => { this.setData({ redeemCode: res.result }); this.doVerify(); },
      fail: () => {}
    });
  },

  async doVerify() {
    const code = this.data.redeemCode.trim();
    if (!code) { wx.showToast({ title: '请输入兑换码', icon: 'none' }); return; }
    wx.showLoading({ title: '核销中', mask: true });
    try {
      const res = await wx.cloud.callFunction({ name: 'verifyRedeem', data: { code } });
      wx.hideLoading();
      if (res.result.ok) {
        this.setData({
          redeemCode: '',
          recent: [{ t: Date.now(), text: `核销 ${res.result.goodsName}` }, ...this.data.recent].slice(0, 10)
        });
        wx.showModal({ title: '核销成功', content: res.result.goodsName, showCancel: false });
      } else {
        wx.showToast({ title: res.result.msg, icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '网络异常', icon: 'none' });
    }
  }
});
