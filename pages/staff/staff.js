const app = getApp();
const { POINT_RULES } = require('../../utils/config.js');
const Y2P = POINT_RULES.YUAN_TO_POINT;   // 1 元 = 几分
const P2Y = POINT_RULES.POINT_TO_YUAN;   // 几分 = 1 元

Page({
  data: {
    isStaff: false,
    checked: false,
    memberNo: '',       // 输入/扫码得到的会员号
    member: null,       // 查到的会员
    amount: '',         // 手动加扣分数额
    consumeYuan: '',    // 消费金额（元）→ 加分
    consumePoints: 0,   // 换算后加的分
    deductYuan: '',     // 抵现金额（元）→ 扣分
    deductPoints: 0,    // 换算后扣的分
    rateY2P: Y2P,
    rateP2Y: P2Y,
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

  // 消费金额 → 自动换算加分预览
  onConsumeInput(e) {
    const yuan = parseFloat(e.detail.value) || 0;
    this.setData({ consumeYuan: e.detail.value, consumePoints: Math.floor(yuan * Y2P) });
  },
  // 抵现金额 → 自动换算扣分预览
  onDeductInput(e) {
    const yuan = parseFloat(e.detail.value) || 0;
    this.setData({ deductYuan: e.detail.value, deductPoints: Math.floor(yuan * P2Y) });
  },

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

  // ② 按消费额加分（消费 N 元 → +N×Y2P 分）
  async addByConsume() {
    const yuan = parseFloat(this.data.consumeYuan);
    if (!yuan || yuan <= 0) { wx.showToast({ title: '请输入消费金额', icon: 'none' }); return; }
    const delta = this.data.consumePoints;
    if (delta <= 0) { wx.showToast({ title: '金额太小，不足 1 分', icon: 'none' }); return; }
    await this._submit(delta, '消费', `消费 ${yuan} 元`, ['consumeYuan', 'consumePoints']);
  },

  // ③ 积分抵现（抵 N 元 → -N×P2Y 分，余额需充足）
  async deductCash() {
    if (!this.data.member) { wx.showToast({ title: '请先查询会员', icon: 'none' }); return; }
    const yuan = parseFloat(this.data.deductYuan);
    if (!yuan || yuan <= 0) { wx.showToast({ title: '请输入抵现金额', icon: 'none' }); return; }
    const points = this.data.deductPoints;
    if (points <= 0) { wx.showToast({ title: '金额太小', icon: 'none' }); return; }
    if (this.data.member.points < points) {
      wx.showToast({ title: `积分不足（需 ${points} 分）`, icon: 'none' });
      return;
    }
    const ok = await new Promise(r => wx.showModal({
      title: '确认抵现',
      content: `抵 ${yuan} 元，扣 ${points} 分。立即扣除，确认？`,
      success: m => r(m.confirm)
    }));
    if (!ok) return;
    await this._submit(-points, '抵现', `抵现 ${yuan} 元`, ['deductYuan', 'deductPoints']);
  },

  // ④ 手动加 / 扣（店员调整，特殊情况用）
  addPoints() { this._manual(1); },
  subPoints() { this._manual(-1); },
  _manual(sign) {
    const val = parseInt(this.data.amount, 10);
    if (!val || val <= 0) { wx.showToast({ title: '请输入正确分值', icon: 'none' }); return; }
    this._submit(val * sign, '店员调整', '', ['amount']);
  },

  // 统一提交：调用 addPoints 云函数 + 更新余额/最近操作
  async _submit(delta, type, remark, clearKeys) {
    if (!this.data.member) { wx.showToast({ title: '请先查询会员', icon: 'none' }); return; }
    wx.showLoading({ title: '处理中', mask: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'addPoints',
        data: { targetUserId: this.data.member._id, delta, type, remark }
      });
      wx.hideLoading();
      if (res.result.ok) {
        const tag = remark || type;
        const rec = `${this.data.member.nickName} ${delta > 0 ? '+' : ''}${delta}分（${tag}）→ 余 ${res.result.balance}`;
        const patch = {
          'member.points': res.result.balance,
          recent: [{ t: Date.now(), text: rec }, ...this.data.recent].slice(0, 10)
        };
        (clearKeys || []).forEach(k => { patch[k] = k.endsWith('Points') ? 0 : ''; });
        this.setData(patch);
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
