// utils/format.js —— 公共工具

// 会员等级（按成长值计算）
const LEVELS = [
  { name: '普通会员', min: 0,    color: '#9a9ab0' },
  { name: '白银会员', min: 500,  color: '#cbd5e1' },
  { name: '黄金会员', min: 1500, color: '#fbbf24' },
  { name: '钻石会员', min: 5000, color: '#22d3ee' }
];

function levelOf(growth) {
  let cur = LEVELS[0];
  for (const l of LEVELS) if (growth >= l.min) cur = l;
  return cur;
}

// 距离下一等级还差多少成长值；满级返回 null
function nextLevel(growth) {
  for (const l of LEVELS) if (growth < l.min) return l;
  return null;
}

// 日期格式化 2026.06.04
function fmtDate(ts) {
  const d = new Date(ts);
  const p = n => (n < 10 ? '0' + n : '' + n);
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

// 生成订单/兑换单号 E + 年月日 + 4位随机
function genOrderNo(prefix = 'E') {
  const d = new Date();
  const p = n => (n < 10 ? '0' + n : '' + n);
  const rnd = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${rnd}`;
}

module.exports = { LEVELS, levelOf, nextLevel, fmtDate, genOrderNo };
