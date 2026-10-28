// Security helpers: so sánh API Key thời gian hằng số, chặn API quản trị khi gọi từ máy khác

const crypto = require('crypto');
const config = require('../config');

const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

// So sánh chuỗi bằng thời gian hằng số (chống timing attack), băm trước để 2 buffer luôn cùng độ dài
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// Chỉ dựa vào địa chỉ socket thật, KHÔNG tin header X-Forwarded-For (có thể bị giả mạo)
function isLoopback(req) {
  return LOOPBACK_ADDRESSES.has(req.socket && req.socket.remoteAddress);
}

// API Key chỉ nhận qua header (không nhận qua query string để tránh lộ trong log / lịch sử trình duyệt)
function hasValidApiKey(req) {
  if (!config.API_KEY) return false;
  const provided = req.headers['x-api-key'];
  return typeof provided === 'string' && provided.length > 0 && safeEqual(provided, config.API_KEY);
}

// Middleware 1: Bắt buộc API Key cho mọi /api/v1/* (trừ /health) khi biến môi trường API_KEY được thiết lập
function requireApiKey(req, res, next) {
  if (!config.API_KEY || req.path === '/health') {
    return next();
  }
  if (!hasValidApiKey(req)) {
    return res.status(401).json({
      success: false,
      error: 'Truy cập bị từ chối: Header "X-API-Key" không hợp lệ hoặc bị thiếu.'
    });
  }
  next();
}

// Có quyền quản trị không?
// - Nếu có API_KEY: phải gửi đúng key (đã kiểm ở requireApiKey).
// - Nếu không có API_KEY (chế độ zero-config): chỉ cho phép gọi từ localhost, trừ khi ALLOW_REMOTE_ADMIN=true.
function isAdminRequest(req) {
  if (config.API_KEY) return hasValidApiKey(req);
  return config.ALLOW_REMOTE_ADMIN || isLoopback(req);
}

// Middleware 2: Bảo vệ các API quản trị (đổi chế độ, đổi tài khoản Gmail, hộp thư ảo, DLQ)
function requireAdmin(req, res, next) {
  if (isAdminRequest(req)) return next();
  return res.status(403).json({
    success: false,
    error: 'API quản trị chỉ cho phép gọi từ localhost hoặc kèm X-API-Key hợp lệ.'
  });
}

module.exports = { safeEqual, isLoopback, hasValidApiKey, isAdminRequest, requireApiKey, requireAdmin };

