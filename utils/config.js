// utils/config.js —— 全局业务配置（改规则集中在这里）
// 注意：云函数是独立部署的，不能 import 本文件；云函数里的同名常量需同步修改（已在各云函数注释标出）

module.exports = {
  // 集合名（和云开发数据库一致）
  COLLECTIONS: {
    USERS: 'users',
    POINTS_LOG: 'points_log',
    GOODS: 'goods',
    REDEEMS: 'redeems',
    STAFF: 'staff',
    UPDATES: 'updates'
  },

  // 积分规则（前端展示用；真正发分逻辑在云函数）
  POINT_RULES: {
    SIGN_REWARD: 10,        // 每日签到 —— 同步：cloudfunctions/signIn
    NEW_MEMBER_BONUS: 120,  // 新客入会（如启用，在 login 云函数发）
    YUAN_TO_POINT: 1,       // 消费 1 元 = 几分（店员「按消费额加分」换算）
    POINT_TO_YUAN: 100,     // 抵现：几分 = 1 元（店员「积分抵现」换算，100 分抵 1 元）
    INVITE_REWARD: 1500,    // 邀请有礼：新人首次消费后，邀请人/新人各得（同步 cloudfunctions/addPoints）
    STAFF_DAILY_ADD_CAP: 50000, // 店员(非管理员)每日加分累计上限，防失控/套利（同步 addPoints）
    BIG_OP_WARN: 5000       // 单次加/扣 ≥ 此值记大额告警（同步 addPoints）
  },

  // 兑换商品分类
  GOODS_CATEGORIES: ['全部', '优惠券', '周边', '贴纸', '盲盒'],

  // 兑换单状态
  REDEEM_STATUS: { PENDING: '待核销', DONE: '已完成', CANCELED: '已取消' },

  // 动态分类
  UPDATE_TYPES: ['全部', '新品到货', '活动预告', '店铺公告']
};
