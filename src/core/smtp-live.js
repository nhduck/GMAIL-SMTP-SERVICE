/**
 * SMTP Live Driver: Kết nối smtp.gmail.com:587 với Connection Pool
 * Thành viên phụ trách: Thành viên 1
 */

const nodemailer = require('nodemailer');
const modeManager = require('./mode-manager');

let transporter = null;

function getTransporter() {
  const { user, pass } = modeManager.getCredentials();
  if (!user || !pass) {
    throw new Error('Chưa cấu hình tài khoản Gmail hoặc App Password!');
  }

  // Tái sử dụng hoặc khởi tạo connection pool
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // TLS
      pool: true,
      maxConnections: 5,
      auth: { user, pass }
    });
  }
  return transporter;
}

module.exports = {
  sendLiveMail: async ({ to, subject, text, html }) => {
    const transport = getTransporter();
    const { user } = modeManager.getCredentials();
    return await transport.sendMail({
      from: `"Auth Email Hub" <${user}>`,
      to,
      subject,
      text,
      html
    });
  },
  resetTransporter: () => {
    transporter = null;
  }
};
