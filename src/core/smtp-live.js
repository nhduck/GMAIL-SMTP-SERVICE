// SMTP Live Driver: Kết nối smtp.gmail.com:587 với Connection Pool
// tích hợp Circuit Breaker bảo vệ tài khoản Gmail

const nodemailer = require('nodemailer');
const modeManager = require('./mode-manager');
const circuitBreaker = require('./circuit-breaker');

let transporter = null;

function getTransporter() {
  const { user, pass } = modeManager.getCredentials();
  if (!user || !pass) {
    throw new Error('Chưa cấu hình tài khoản Gmail hoặc App Password!');
  }

  // Tái sử dụng transporter nếu đã có
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // Sử dụng STARTTLS trên cổng 587
      pool: true,
      maxConnections: 3,   // Giữ tối đa 3 socket đồng thời
      maxMessages: 100,    // Tối đa 100 email trên 1 connection
      rateDelta: 1000,     // 1 giây
      rateLimit: 14,       // Tối đa 14 email / giây
      auth: {
        user: user.trim(),
        pass: pass.replace(/\s+/g, '')
      }
    });

    // Bắt lỗi rò rỉ socket của connection pool
    transporter.on('idle', () => {
      // Sẵn sàng tiếp nhận job mới
    });
    transporter.on('error', (err) => {
      console.error('[SMTP Transporter Pool Error]', err.message);
    });
  }
  return transporter;
}

module.exports = {
  sendLiveMail: async ({ to, subject, text, html }) => {
    // 1. Kiểm tra trạng thái Circuit Breaker trước khi gửi
    if (!circuitBreaker.canExecute()) {
      throw new Error('Circuit Breaker đang ở trạng thái OPEN. Tạm ngừng gửi để bảo vệ tài khoản Gmail!');
    }

    try {
      const transport = getTransporter();
      const { user } = modeManager.getCredentials();

      const info = await transport.sendMail({
        from: `"Auth Email Hub" <${user}>`,
        to,
        subject,
        text,
        html
      });

      // 2. Ghi nhận thành công cho Circuit Breaker
      circuitBreaker.recordSuccess();
      return info;
    } catch (err) {
      // 3. Ghi nhận lỗi cho Circuit Breaker
      circuitBreaker.recordFailure(err);
      throw err;
    }
  },

  // Dùng khi người dùng cập nhật lại tài khoản Gmail trong Dashboard
  resetTransporter: () => {
    if (transporter) {
      try {
        transporter.close();
      } catch (e) { }
      transporter = null;
    }
    circuitBreaker.manualReset();
  }
};
