// app.js —— 小程序入口
App({
  globalData: {
    openid: null,
    userInfo: null,   // users 集合里的会员记录
    isStaff: false,   // 是否店员（在 staff 白名单 + 7天会话未过期）
    isAdmin: false,   // 是否管理员（店员 + role==='admin' + 会话有效）
    staffInfo: null,  // 店员记录（已隐去密钥）
    staffState: null, // { exists, role, hasSecret, sessionValid, sessionExpireAt } 供员工入口页
    envId: 'cloud1-d3gbpj97870c1a7cd' // TODO: 替换成你云开发控制台里的环境 ID
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      this.loginReady = true;   // 放行页面，避免永久等待
      return;
    }
    wx.cloud.init({
      env: this.globalData.envId,
      traceUser: true
    });
    this.login();
  },

  loginReady: false,   // login 是否已跑完（无论成败）
  _waiters: [],        // 等待登录结果的页面回调队列

  // 登录：调用 login 云函数拿 openid，并 upsert 会员记录
  login() {
    return wx.cloud.callFunction({ name: 'login' })
      .then(res => {
        const r = (res && res.result) || {};
        this.globalData.openid = r.openid || null;
        this.globalData.userInfo = r.user || null;
        this.globalData.isStaff = !!r.isStaff;
        this.globalData.staffInfo = r.staffInfo || null;
        this.globalData.staffState = r.staffState || null;  // 启用/会话状态，供员工入口页 UX
        this.globalData.isAdmin = !!r.isAdmin;               // 由服务端按会话计算
        this.globalData.loginError = null;
      })
      .catch(err => {
        // 失败也不能让页面卡死：记录错误，照常放行
        console.error('login 失败', err);
        this.globalData.loginError = err;
      })
      .then(() => {
        // 无论成功失败，统一在这里放行所有等待的页面
        this.loginReady = true;
        const ws = this._waiters;
        this._waiters = [];
        ws.forEach(fn => fn(this.globalData));
        return this.globalData;
      });
  },

  // 页面拿用户信息的统一入口（处理"页面先加载、登录还没回来"的时序）
  // login 跑完即 resolve（即便失败，openid 为 null，页面自行兜底）
  getUser() {
    return new Promise(resolve => {
      if (this.loginReady) resolve(this.globalData);
      else this._waiters.push(resolve);
    });
  },

  // 刷新会员信息（加分/兑换后调用）
  refreshUser() {
    return this.login();
  }
});
