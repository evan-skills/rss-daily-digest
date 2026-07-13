const crypto = require('crypto');
const { SETTINGS_TOKEN } = require('./config');

// 是否启用了设置保护
function isProtectionEnabled() {
  return Boolean(SETTINGS_TOKEN);
}

// 定长哈希后用 timingSafeEqual 比较，避免时序攻击
function tokenMatches(provided) {
  if (!SETTINGS_TOKEN) return true; // 未配置令牌则不校验
  if (!provided) return false;
  const a = crypto.createHash('sha256').update(String(provided)).digest();
  const b = crypto.createHash('sha256').update(SETTINGS_TOKEN).digest();
  return crypto.timingSafeEqual(a, b);
}

// 从请求中取令牌：优先 header，其次 query
function extractToken(req) {
  return req.get('X-Settings-Token') || req.query.token || '';
}

// 校验请求是否解锁了设置
function isUnlocked(req) {
  return tokenMatches(extractToken(req));
}

// Express 中间件：保护设置相关接口
function requireToken(req, res, next) {
  if (isUnlocked(req)) return next();
  res.status(401).json({ error: '未授权：无效或缺失的设置令牌' });
}

module.exports = { isProtectionEnabled, tokenMatches, extractToken, isUnlocked, requireToken };
