Component({
  data: {
    selected: 0,
    list: [
      { path: '/pages/index/index', text: '首页', icon: '/assets/tab/home.png' },
      { path: '/pages/redeem/redeem', text: '兑换', icon: '/assets/tab/redeem.png' },
      { path: '/pages/member-code/member-code', text: '会员码', icon: '/assets/tab/code.png' },
      { path: '/pages/member/member', text: '我的', icon: '/assets/tab/me.png' }
    ]
  },
  methods: {
    switchTab(e) {
      const i = e.currentTarget.dataset.index;
      const path = this.data.list[i].path;
      this.setData({ selected: i });
      wx.switchTab({ url: path });
    }
  }
});
