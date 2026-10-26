/**
 * demo-app/server.js
 * Máy chủ Express cho Demo Ứng Dụng Xin Nghỉ Phép (Cổng 4000)
 * Độc lập với Email Service (Cổng 3000), gọi qua HTTP REST API
 */

require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const store = require('./store');
const mailer = require('./mailer');

const app = express();
const PORT = process.env.DEMO_PORT || 4000;
const DEMO_APP_URL = process.env.DEMO_APP_URL || `http://localhost:${PORT}`;
const MANAGER_EMAIL = (process.env.MANAGER_EMAIL || 'manager@demo.local').toLowerCase().trim();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Phục vụ giao diện tĩnh
app.use(express.static(path.join(__dirname, 'public')));

// Middleware xác thực phiên đơn giản qua Bearer Token
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const session = store.getSession(token);

  if (!session) {
    return res.status(401).json({ success: false, error: 'Chưa đăng nhập hoặc phiên làm việc đã hết hạn.' });
  }

  req.user = session;
  next();
}

// HEALTH & THÔNG TIN HỆ THỐNG
app.get('/api/info', (req, res) => {
  res.json({
    app: 'Demo Ứng Dụng Nghỉ Phép (SOA Client)',
    managerEmail: MANAGER_EMAIL,
    demoAppUrl: DEMO_APP_URL,
    serviceUrl: process.env.SERVICE_URL || 'http://localhost:3000'
  });
});

// ĐĂNG KÝ TÀI KHOẢN
app.post('/api/register', async (req, res) => {
  try {
    const { email, name, password } = req.body;
    if (!email || !name || !password) {
      return res.status(400).json({ success: false, error: 'Vui lòng điền đầy đủ Email, Họ tên và Mật khẩu.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Mật khẩu phải có độ dài tối thiểu 6 ký tự.' });
    }

    const user = store.createUser({ email, name, password });
    const otp = store.createOtp(user.email);

    // Gọi Email Service Gateway gửi OTP
    const mailRes = await mailer.sendVerificationEmail({
      to: user.email,
      name: user.name,
      otp
    });

    if (!mailRes.success) {
      return res.status(502).json({
        success: false,
        error: `Email Service từ chối gửi thư: ${mailRes.error}`
      });
    }

    // Ở môi trường Sandbox hoặc local, có thể trả kèm sandboxOtp để tiện chạy test tự động or demo nhanh
    const isSandbox = (process.env.MODE || 'SANDBOX') !== 'LIVE_GMAIL';

    res.json({
      success: true,
      message: 'Đăng ký thành công! Mã OTP xác thực 6 số đã được gửi tới email của bạn.',
      email: user.email,
      sandboxOtp: isSandbox ? otp : undefined
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// XÁC THỰC MÃ OTP
app.post('/api/verify', (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ success: false, error: 'Vui lòng cung cấp email và mã OTP.' });
  }

  const result = store.verifyOtp(email, otp);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error });
  }

  // Tự động tạo phiên làm việc sau khi kích hoạt thành công
  const sessionId = store.createSession(result.user);
  res.json({
    success: true,
    message: 'Tài khoản đã được kích hoạt thành công!',
    token: sessionId,
    user: {
      email: result.user.email,
      name: result.user.name,
      role: result.user.role
    }
  });
});

// ĐĂNG NHẬP
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Vui lòng nhập email và mật khẩu.' });
  }

  const user = store.getUser(email);
  if (!user) {
    return res.status(400).json({ success: false, error: 'Email hoặc mật khẩu không chính xác.' });
  }

  if (!user.isVerified) {
    return res.status(403).json({
      success: false,
      error: 'Tài khoản chưa được xác thực OTP. Vui lòng nhập mã OTP để kích hoạt trước.'
    });
  }

  const { verifyPassword } = require('./store');
  // So sánh hash
  const crypto = require('crypto');
  const resultHash = crypto.scryptSync(password, user.salt, 64).toString('hex');
  if (resultHash !== user.passwordHash) {
    return res.status(400).json({ success: false, error: 'Email hoặc mật khẩu không chính xác.' });
  }

  const sessionId = store.createSession(user);
  res.json({
    success: true,
    token: sessionId,
    user: {
      email: user.email,
      name: user.name,
      role: user.role
    }
  });
});

// LẤY THÔNG TIN TÀI KHOẢN ĐANG ĐĂNG NHẬP
app.get('/api/me', authenticate, (req, res) => {
  res.json({ success: true, user: req.user });
});

// TẠO ĐƠN XIN NGHỈ PHÉP
app.post('/api/leaves', authenticate, async (req, res) => {
  try {
    const { startDate, endDate, days, reason } = req.body;
    if (!startDate || !endDate || !reason) {
      return res.status(400).json({ success: false, error: 'Nhân viên vui lòng cung cấp ngày bắt đầu, ngày kết thúc và lý do.' });
    }

    const leave = store.createLeave({
      employeeEmail: req.user.email,
      employeeName: req.user.name,
      startDate,
      endDate,
      days: days || 1,
      reason
    });

    // Tạo link an toàn cho Quản lý (chỉ mở trang xác nhận GET, không duyệt thẳng)
    const approveUrl = `${DEMO_APP_URL}/decision/${leave.decisionToken}?action=approve`;
    const rejectUrl = `${DEMO_APP_URL}/decision/${leave.decisionToken}?action=reject`;

    // Gọi Email Service gửi thư Action Email tới Quản lý
    const mailRes = await mailer.sendLeaveRequestToManager({
      managerEmail: MANAGER_EMAIL,
      leave,
      approveUrl,
      rejectUrl
    });

    if (!mailRes.success) {
      console.warn('[Demo App] Gửi thư tới quản lý thất bại:', mailRes.error);
    }

    res.json({
      success: true,
      message: `Đơn xin nghỉ phép đã được gửi thành công tới Quản lý (${MANAGER_EMAIL}).`,
      leave
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// LẤY DANH SÁCH ĐƠN NGHỈ PHÉP CỦA TÔI
app.get('/api/leaves', authenticate, (req, res) => {
  const list = store.getLeavesByEmployee(req.user.email);
  res.json({ success: true, leaves: list });
});

// TRANG XÁC NHẬN PHÊ DUYỆT CỦA QUẢN LÝ
app.get('/decision/:token', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'decision.html'));
});

// Lấy thông tin đơn để hiển thị trên trang xác nhận
app.get('/api/decision-info/:token', (req, res) => {
  const result = store.getDecisionByToken(req.params.token);
  if (!result.valid) {
    return res.status(400).json({ success: false, error: result.error });
  }

  res.json({
    success: true,
    leave: {
      id: result.leave.id,
      employeeName: result.leave.employeeName,
      employeeEmail: result.leave.employeeEmail,
      startDate: result.leave.startDate,
      endDate: result.leave.endDate,
      days: result.leave.days,
      reason: result.leave.reason,
      status: result.leave.status,
      createdAt: result.leave.createdAt
    }
  });
});

// Quản lý bấm nút POST xác nhận quyết định (Approve / Reject)
app.post('/api/decision', async (req, res) => {
  const { token, action } = req.body;
  if (!token || !action) {
    return res.status(400).json({ success: false, error: 'Thiếu mã token hoặc hành động quyết định.' });
  }

  const result = store.processDecision(token, action);
  if (!result.valid) {
    return res.status(400).json({ success: false, error: result.error });
  }

  // Gửi thông báo kết quả tức thì về email của Nhân viên
  const mailRes = await mailer.sendLeaveResultToEmployee({
    employeeEmail: result.leave.employeeEmail,
    leave: result.leave,
    action: action.toUpperCase()
  });

  if (!mailRes.success) {
    console.warn('[Demo App] Gửi email kết quả cho nhân viên thất bại:', mailRes.error);
  }

  res.json({
    success: true,
    message: action.toUpperCase() === 'APPROVE'
      ? 'Đã duyệt đơn thành công! Email thông báo đã gửi về nhân viên.'
      : 'Đã từ chối đơn! Email thông báo đã gửi về nhân viên.',
    leave: result.leave
  });
});

// QUÊN MẬT KHẨU
app.post('/api/forgot', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: 'Vui lòng cung cấp email của bạn.' });
  }

  const tokenData = store.createResetToken(email);
  if (tokenData) {
    const resetUrl = `${DEMO_APP_URL}/#reset-${tokenData.resetToken}`;
    // Gọi Email Service gửi thư đặt lại mật khẩu với TTL 5 phút
    await mailer.sendPasswordResetEmail({
      to: tokenData.user.email,
      name: tokenData.user.name,
      resetUrl
    });
  }

  // Luôn trả về thông báo chung tránh dò email
  res.json({
    success: true,
    message: 'Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi đến hòm thư của bạn.'
  });
});

// Đặt lại mật khẩu mới
app.post('/api/reset', (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ success: false, error: 'Thiếu thông tin token hoặc mật khẩu mới.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, error: 'Mật khẩu mới phải từ 6 ký tự trở lên.' });
  }

  const result = store.resetPassword(token, newPassword);
  if (!result.valid) {
    return res.status(400).json({ success: false, error: result.error });
  }

  res.json({ success: true, message: result.message });
});

// Khởi chạy Server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🏢 Máy chủ đang chạy tại: ${DEMO_APP_URL}`);
    console.log(`👤 [Quản lý mặc định]: ${MANAGER_EMAIL}`);
    console.log(`🔗 [Kết nối Gateway]:  ${process.env.SERVICE_URL || 'http://localhost:3000'}`);
  });
}

module.exports = app;
