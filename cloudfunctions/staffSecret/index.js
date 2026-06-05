// 云函数 staffSecret —— 【已停用】
// 原为店员自助生成/重置个人 TOTP 密钥；为消除「店员自助 vs 店长发放」的双通道与越权风险，
// 现统一由店长在后台「店铺管理 → 店员 → 生成码/重置码」发放（云函数 admin 的 staffGenSecret）。
// 保留此 tombstone 以使已部署的端点安全失效——直接调用也不再下发密钥。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async () => {
  return { ok: false, disabled: true, msg: '店员动态码已统一由店长在后台发放，请联系店长生成/重置' };
};
