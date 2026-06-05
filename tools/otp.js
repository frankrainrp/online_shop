// 本地 OTP 出码工具：打印当前可用的 6 位动态码，用于测试员工入口登录
// 用法：在项目根目录执行  node tools/otp.js
// 注意：这里的密钥必须和 cloudfunctions/claimAdmin/index.js 里的 TOTP_SECRET 一致
const crypto = require('crypto');
const fs = require('fs'), path = require('path');

// 密钥不写进仓库：优先环境变量 TOTP_SECRET，其次本地文件 tools/.totp_secret（已 gitignore）
let TOTP_SECRET = process.env.TOTP_SECRET || '';
if (!TOTP_SECRET) {
  try { TOTP_SECRET = fs.readFileSync(path.join(__dirname, '.totp_secret'), 'utf8').trim(); } catch (e) {}
}
if (!TOTP_SECRET) {
  console.error('未找到密钥。请设置环境变量 TOTP_SECRET，或创建 tools/.totp_secret 文件填入 base32 密钥。');
  process.exit(1);
}
const STEP = 30, DIGITS = 6;

function base32Decode(b32) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of String(b32).toUpperCase().replace(/[^A-Z2-7]/g, '')) bits += A.indexOf(c).toString(2).padStart(5, '0');
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.substr(i, 8), 2));
  return Buffer.from(bytes);
}
function hotp(key, counter) {
  const buf = Buffer.alloc(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) { buf[i] = c & 0xff; c = Math.floor(c / 256); }
  const h = crypto.createHmac('sha1', key).update(buf).digest();
  const o = h[h.length - 1] & 0xf;
  const n = ((h[o] & 0x7f) << 24) | ((h[o + 1] & 0xff) << 16) | ((h[o + 2] & 0xff) << 8) | (h[o + 3] & 0xff);
  return (n % (10 ** DIGITS)).toString().padStart(DIGITS, '0');
}

const key = base32Decode(TOTP_SECRET);
const counter = Math.floor(Date.now() / 1000 / STEP);
const remain = STEP - Math.floor(Date.now() / 1000) % STEP;
console.log('');
console.log('  当前动态码：', hotp(key, counter));
console.log('  剩余有效：  约 ' + remain + ' 秒（过期就再跑一次本命令）');
console.log('');
