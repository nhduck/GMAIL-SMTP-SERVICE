// Global Configuration for Email Service Gateway 
// Quản lý biến môi trường, TTL mặc định và chính sách bảo mật

require('dotenv').config();

const parsedTtl = parseInt(process.env.RESET_TTL_MINUTES, 10);

module.exports = {
  // Thời hạn mặc định cho liên kết đặt lại mật khẩu (5 phút)
  RESET_TTL_MINUTES: Number.isInteger(parsedTtl) && parsedTtl > 0 ? parsedTtl : 5,

  // Giới hạn thời hạn cho phép (1 phút đến 1440 phút tương đương 24 giờ)
  MIN_RESET_TTL_MINUTES: 1,
  MAX_RESET_TTL_MINUTES: 1440,

  // Tùy chọn xác thực API Key (Nếu .env có đặt API_KEY thì bắt buộc kiểm tra)
  API_KEY: process.env.API_KEY || null
};
