// Global Configuration for Email Service Gateway 
// Quản lý biến môi trường, TTL mặc định và chính sách bảo mật

require('dotenv').config();

function parsePositiveInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

module.exports = {
  // Thời hạn mặc định cho liên kết đặt lại mật khẩu (5 phút)
  RESET_TTL_MINUTES: parsePositiveInt(process.env.RESET_TTL_MINUTES, 5),

  // Giới hạn thời hạn cho phép (1 phút đến 1440 phút tương đương 24 giờ)
  MIN_RESET_TTL_MINUTES: 1,
  MAX_RESET_TTL_MINUTES: 1440,

  // Thời hạn mặc định của mã OTP hiển thị trong email (phải khớp với thời hạn ứng dụng nghiệp vụ lưu OTP)
  OTP_TTL_MINUTES: parsePositiveInt(process.env.OTP_TTL_MINUTES, 5),
  MIN_OTP_TTL_MINUTES: 1,
  MAX_OTP_TTL_MINUTES: 60,

  // Tên người gửi hiển thị mặc định (có thể ghi đè theo từng request qua trường "appName")
  MAIL_FROM_NAME: process.env.MAIL_FROM_NAME || 'TMT Company',

  // Tùy chọn xác thực API Key (Nếu .env có đặt API_KEY thì bắt buộc gửi header X-API-Key)
  API_KEY: process.env.API_KEY || null,

  // Các API quản trị (đổi chế độ, đổi tài khoản Gmail, xem hộp thư ảo, DLQ) mặc định chỉ cho phép
  // gọi từ chính máy chủ (localhost). Đặt ALLOW_REMOTE_ADMIN=true khi chạy trong Docker (port đã bind 127.0.0.1).
  ALLOW_REMOTE_ADMIN: process.env.ALLOW_REMOTE_ADMIN === 'true'
};
