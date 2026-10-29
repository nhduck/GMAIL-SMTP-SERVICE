/**
 * demo-app/server.js
 * Máy chủ Express cho Demo Ứng Dụng Xin Nghỉ Phép (Cổng 4000)
 * Độc lập với Email Service (Cổng 3000), gọi qua HTTP REST API & nhận Webhook phản hồi từ Email Reply
 */

require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const store = require('./store');
const mailer = require('./mailer');
const { extractPureEmail } = require('../src/core/text-cleaner');

const app = express();
const PORT = process.env.DEMO_PORT || 4000;
const DEMO_APP_URL = process.env.DEMO_APP_URL || `http://localhost:${PORT}`;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'sec_seminar_webhook_key';

// Bộ giới hạn tần suất (Rate Limiter) đơn giản chống spam email (email bombing) trên /api/register và /api/forgot
const rateBuckets = new Map(); // key -> { count, resetAt }
function createRateLimiter({ windowMs = 60 * 1000, max = 10, label = 'yêu cầu' } = {}) {
  return (req, res, next) => {
    const ip = (req.socket && req.socket.remoteAddress) || 'local';
    const emailKey = req.body && req.body.email ? String(req.body.email).toLowerCase().trim() : '';
    const key = `${req.path}:${ip}:${emailKey}`;
    const now = Date.now();
    const record = rateBuckets.get(key);

    if (!record || now > record.resetAt) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (record.count >= max) {
      const waitSec = Math.ceil((record.resetAt - now) / 1000);
      return res.status(429).json({
        success: false,
        error: `Bạn đã gửi quá nhiều ${label} liên tiếp. Vui lòng thử lại sau ${waitSec} giây.`
      });
    }

    record.count += 1;
    next();
  };
}

// Lấy địa chỉ Quản lý mặc định từ biến môi trường (KHÔNG tự lấy Gmail của dịch vụ để tránh vòng lặp Reply)
function resolveManagerEmail() {
  return (process.env.MANAGER_EMAIL || 'manager@demo.local').toLowerCase().trim();
}

app.use(cors());
app.use(express.json({ limit: '100kb' }));
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
app.get('/api/info', async (req, res) => {
  const activeManager = resolveManagerEmail();
  res.json({
    app: 'Cổng Thông Tin Nhân Sự TMT Company',
    managerEmail: activeManager,
    demoAppUrl: DEMO_APP_URL,
    serviceUrl: process.env.SERVICE_URL || 'http://localhost:3000'
  });
});

// ĐĂNG KÝ TÀI KHOẢN (có rate limit chống spam OTP)
app.post('/api/register', createRateLimiter({ windowMs: 60 * 1000, max: 10, label: 'yêu cầu đăng ký' }), async (req, res) => {
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

    // Bảo mật: Chỉ trả kèm sandboxOtp khi Gateway thực sự đang ở chế độ SANDBOX
    const gatewayMode = mailRes.data && mailRes.data.mode;
    const isSandbox = gatewayMode === 'SANDBOX';

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

  // So sánh hash bằng crypto.timingSafeEqual thông qua store.verifyPassword
  if (!store.verifyPassword(password, user.passwordHash, user.salt)) {
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
    const { startDate, endDate, days, reason, managerEmail } = req.body;
    if (!startDate || !endDate || !reason) {
      return res.status(400).json({ success: false, error: 'Nhân viên vui lòng cung cấp đầy đủ ngày bắt đầu, ngày kết thúc và lý do nghỉ.' });
    }

    // Ràng buộc 1: Ngày bắt đầu không được ở trong quá khứ
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (startDate < todayStr) {
      return res.status(400).json({
        success: false,
        error: `Ngày bắt đầu nghỉ (${startDate}) không thể ở trong quá khứ (hôm nay là ${todayStr}).`
      });
    }

    // Ràng buộc 2: Ngày kết thúc không được nhỏ hơn ngày bắt đầu
    if (endDate < startDate) {
      return res.status(400).json({
        success: false,
        error: `Ngày kết thúc (${endDate}) không được trước ngày bắt đầu (${startDate}).`
      });
    }

    // Ràng buộc 3: Số ngày nghỉ tối thiểu 0.5 ngày
    const numDays = parseFloat(days);
    if (isNaN(numDays) || numDays <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Số ngày nghỉ không hợp lệ (tối thiểu 0.5 ngày).'
      });
    }

    // Ràng buộc 4: Lý do xin nghỉ tối thiểu 3 ký tự
    const cleanReason = String(reason).trim();
    if (cleanReason.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Vui lòng nhập lý do xin nghỉ rõ ràng (tối thiểu 3 ký tự).'
      });
    }

    // Xác định email Quản lý nhận đơn: Ưu tiên form nhập -> .env -> Sandbox mặc định
    const targetManager = (managerEmail && String(managerEmail).trim().toLowerCase()) || resolveManagerEmail();

    const leave = store.createLeave({
      employeeEmail: req.user.email,
      employeeName: req.user.name,
      startDate,
      endDate,
      days: numDays,
      reason: cleanReason,
      managerEmail: targetManager
    });

    // Gọi Email Service gửi thư yêu cầu phê duyệt tới Quản lý (chuẩn 2 chiều: Quản lý Reply trực tiếp trong Gmail)
    const mailRes = await mailer.sendLeaveRequestToManager({
      managerEmail: targetManager,
      leave
    });

    if (!mailRes.success) {
      console.warn('[Demo App] Gửi thư tới quản lý thất bại:', mailRes.error);
    }

    res.json({
      success: true,
      message: `Đơn xin nghỉ phép đã được gửi thành công tới Quản lý (${targetManager}). Quản lý chỉ cần Reply "Duyệt" hoặc "Từ chối" trên Gmail.`,
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

// WEBHOOK HANDLER: Xử lý sự kiện email.reply.received từ Email Gateway (Cổng 3000)
// Hỗ trợ cả 2 endpoint: /api/webhook/email-reply (chuẩn mới) và /api/email-received (tương thích ngược)
async function handleWebhookEmailReply(req, res) {
  // 1. Kiểm tra xác thực khóa bí mật X-Webhook-Secret
  const incomingSecret = req.headers['x-webhook-secret'];
  if (!incomingSecret || incomingSecret !== WEBHOOK_SECRET) {
    console.warn('[Webhook Consumer] Từ chối: X-Webhook-Secret không khớp hoặc bị thiếu.');
    return res.status(401).json({ success: false, error: 'Xác thực Webhook Secret không hợp lệ.' });
  }

  const { event, data } = req.body;
  if (event !== 'email.reply.received' || !data) {
    return res.status(400).json({ success: false, error: 'Payload không đúng định dạng sự kiện email.reply.received.' });
  }

  console.log(`[Webhook Consumer] Nhận sự kiện email.reply.received từ ${data.from}: "${data.replyText}"`);

  // 2. Bóc tách mã đơn nghỉ phép #lv_[a-f0-9]{12} từ Subject hoặc ReplyText
  const subjectStr = String(data.subject || '');
  const textStr = String(data.replyText || '');
  const match = subjectStr.match(/(lv_[a-f0-9]{12})/i) || textStr.match(/(lv_[a-f0-9]{12})/i);

  if (!match) {
    console.log('[Webhook Consumer] Bỏ qua: Không tìm thấy mã đơn nghỉ phép trong tiêu đề hoặc nội dung.');
    return res.json({ success: true, ignored: true, reason: 'NO_LEAVE_ID' });
  }

  const leaveId = match[1].toLowerCase();
  const leave = store.getLeave(leaveId);
  if (!leave) {
    console.log(`[Webhook Consumer] Bỏ qua: Không tìm thấy đơn nghỉ phép #${leaveId}.`);
    return res.json({ success: true, ignored: true, reason: 'LEAVE_NOT_FOUND' });
  }

  // 3. Kiểm tra địa chỉ người gửi: Người gửi phải khớp với Quản lý được phân công (hoặc Quản lý mặc định hệ thống)
  const pureSender = extractPureEmail(data.from || '');
  const expectedManager = (leave.managerEmail || resolveManagerEmail()).toLowerCase();
  const defaultManager = resolveManagerEmail();

  const isSenderAuthorized =
    pureSender === expectedManager ||
    pureSender === (leave.managerEmail || '').toLowerCase() ||
    pureSender === defaultManager ||
    pureSender === 'manager@demo.local';

  if (!isSenderAuthorized) {
    console.warn(`[Webhook Consumer] Từ chối xử lý: Người gửi (${pureSender}) không khớp với Quản lý phụ trách (${expectedManager}) của đơn #${leaveId}.`);
    return res.json({
      success: true,
      ignored: true,
      reason: 'SENDER_NOT_MANAGER',
      message: `Người gửi (${pureSender}) không khớp với Quản lý phụ trách đơn (${expectedManager}).`
    });
  }

  // 4. Chống Replay Attack: Đơn đã xử lý trước đó thì không xử lý lại
  if (leave.status !== 'PENDING') {
    console.log(`[Webhook Consumer] Bỏ qua: Đơn #${leaveId} đã được quyết định trước đó (${leave.status}).`);
    return res.json({
      success: true,
      ignored: true,
      reason: 'ALREADY_DECIDED',
      status: leave.status
    });
  }

  // 5. Phân tích ngữ nghĩa theo ranh giới từ (\b) sau khi chuẩn hóa bỏ dấu tiếng Việt
  const normalizedText = textStr
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  // Kiểm tra từ chối / phủ định trước
  const rejectRegex = /\b(tu choi|reject|khong duyet|chua duyet|khong dong y|bac bo)\b/i;
  const hasReject = rejectRegex.test(normalizedText);

  // Để kiểm tra chấp thuận: loại bỏ các cụm phủ định ("khong duyet", "khong dong y", "dung duyet", "chua duyet")
  // để tránh việc từ "duyet" trong "khong duyet" bị nhận diện nhầm là approve
  const textWithoutNegative = normalizedText.replace(/\b(khong|chua|dung)\s+(duyet|dong y|chap thuan)\b/g, '');
  const approveRegex = /\b(duyet|approve|dong y|ok|chap thuan)\b/i;
  const hasApprove = approveRegex.test(textWithoutNegative);

  // 6. Xử lý trường hợp mâu thuẫn (vừa có duyệt vừa có từ chối) hoặc không rõ ràng
  if ((hasReject && hasApprove) || (!hasReject && !hasApprove)) {
    console.log(`[Webhook Consumer] Cú pháp phản hồi mơ hồ cho đơn #${leaveId}: "${data.replyText}". Gửi thư nhắc cú pháp...`);
    await mailer.sendClarificationEmail({
      managerEmail: expectedManager,
      leaveId,
      receivedText: data.replyText
    });
    return res.json({
      success: true,
      ambiguous: true,
      message: 'Nội dung phản hồi không rõ ràng, đã gửi email nhắc nhở cú pháp cho Quản lý.'
    });
  }

  // 7. Xác định quyết định dứt khoát
  const action = hasReject ? 'REJECT' : 'APPROVE';
  const result = store.processDecisionDirect(leaveId, action, 'EMAIL_REPLY');

  if (!result.valid) {
    return res.json({ success: true, ignored: true, reason: result.error });
  }

  // 8. Tự động gửi email kết quả về cho Nhân viên
  const mailRes = await mailer.sendLeaveResultToEmployee({
    employeeEmail: leave.employeeEmail,
    leave: result.leave,
    action
  });

  if (!mailRes.success) {
    console.warn('[Demo App] Gửi email kết quả cho nhân viên thất bại:', mailRes.error);
  }

  console.log(`✓ [Webhook Consumer] Đã phê duyệt đơn #${leaveId} thành công với kết quả ${result.leave.status} qua Email Reply!`);
  return res.json({
    success: true,
    message: `Đã cập nhật đơn #${leaveId} sang ${result.leave.status} qua Email Reply.`,
    leave: result.leave
  });
}

// Đăng ký cả 2 route để tương thích mọi cấu hình
app.post('/api/webhook/email-reply', handleWebhookEmailReply);
app.post('/api/email-received', handleWebhookEmailReply);

// TRANG XÁC NHẬN PHÊ DUYỆT DỰ PHÒNG QUA WEB
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

// Quản lý bấm nút POST xác nhận quyết định qua Web (Dự phòng)
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

// QUÊN MẬT KHẨU (có rate limit chống spam email đặt lại mật khẩu)
app.post('/api/forgot', createRateLimiter({ windowMs: 60 * 1000, max: 5, label: 'yêu cầu đặt lại mật khẩu' }), async (req, res) => {
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
  app.listen(PORT, async () => {
    const activeMgr = resolveManagerEmail();
    console.log(`🏢 Máy chủ đang chạy tại: ${DEMO_APP_URL}`);
    console.log(`👤 [Quản lý mặc định]: ${activeMgr}`);
    console.log(`🔗 [Kết nối Gateway]:  ${process.env.SERVICE_URL || 'http://localhost:3000'}`);
  });
}

module.exports = app;
