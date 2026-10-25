/**
 * Mail Controller: Tiếp nhận gửi mail, kiểm tra validation RFC 5322,
 * hỗ trợ 3 use case cốt lõi: Account Verification, Password Reset, HTML Email Templates
 * Thành viên phụ trách: Thành (Core Backend)
 */

const modeManager = require('../core/mode-manager');
const sandboxStore = require('../core/sandbox-store');
const queue = require('../core/queue');
const smtpLive = require('../core/smtp-live');
const circuitBreaker = require('../core/circuit-breaker');
const validator = require('../core/validator');
const templates = require('../core/templates');

// Helper nội bộ xử lý phân phối thư (Sandbox vs Live Queue)
async function dispatchEmail({ to, subject, text, html, extra = {} }, req, res, startTime) {
  const mode = modeManager.getMode();

  // 1. Chế độ SANDBOX (Dev Mode)
  if (mode === 'SANDBOX') {
    const saved = sandboxStore.addMail({ to, subject, text, html });

    if (req.app.get('broadcastWs')) {
      req.app.get('broadcastWs')({ type: 'NEW_MAIL', data: saved });
    }

    const diff = process.hrtime(startTime);
    const latencyMs = Math.round((diff[0] * 1000 + diff[1] / 1e6) * 100) / 100;
    res.setHeader('X-Response-Time-Ms', latencyMs);

    return res.status(202).json({
      success: true,
      message: 'Đã nhận yêu cầu gửi mail (Chế độ Sandbox).',
      mailId: saved.id,
      mode: 'SANDBOX',
      slaLatencyMs: latencyMs,
      ...extra
    });
  }

  // 2. Chế độ LIVE_GMAIL
  if (!circuitBreaker.canExecute()) {
    return res.status(503).json({
      success: false,
      error: 'Dịch vụ SMTP tạm ngưng để bảo vệ tài khoản (Circuit Breaker OPEN).',
      circuitBreaker: circuitBreaker.getStatus()
    });
  }

  const enqueueResult = queue.enqueue(
    { to, subject, text, html },
    async () => {
      await smtpLive.sendLiveMail({ to, subject, text, html });
    }
  );

  const diff = process.hrtime(startTime);
  const latencyMs = Math.round((diff[0] * 1000 + diff[1] / 1e6) * 100) / 100;
  res.setHeader('X-Response-Time-Ms', latencyMs);

  // Bảo mật: Ở chế độ LIVE_GMAIL, TUYỆT ĐỐI KHÔNG trả về mã OTP trong HTTP Response
  const liveExtra = { ...extra };
  delete liveExtra.otp;

  return res.status(202).json({
    success: true,
    message: 'Đã tiếp nhận yêu cầu gửi Gmail (Đang xử lý trong hàng đợi).',
    jobId: enqueueResult.jobId,
    queueLength: enqueueResult.queueLength,
    mode: 'LIVE_GMAIL',
    slaLatencyMs: latencyMs,
    ...liveExtra
  });
}

module.exports = {
  // 1. CHỨC NĂNG 1: POST /api/v1/verify-email (Xác thực tài khoản)
  verifyEmail: async (req, res) => {
    const startTime = process.hrtime();
    const { to, name, verifyUrl, appName } = req.body;

    if (!to || !validator.isValidEmail(to)) {
      return res.status(400).json({ success: false, error: 'Địa chỉ email người nhận ("to") không hợp lệ.' });
    }

    // Nếu không truyền verifyUrl và không có otp, tự sinh mã OTP ngẫu nhiên 6 chữ số
    let otp = req.body.otp;
    if (!verifyUrl && !otp) {
      otp = Math.floor(100000 + Math.random() * 900000).toString();
    }

    const rendered = templates.render('verify-email', {
      name: name || 'Bạn',
      otp,
      verifyUrl,
      appName: appName || 'Auth Service'
    });

    return await dispatchEmail(
      {
        to,
        subject: req.body.subject || rendered.subject,
        html: rendered.html,
        text: `Mã xác thực tài khoản của bạn là: ${otp || verifyUrl}`,
        extra: {
          type: 'ACCOUNT_VERIFICATION',
          otp: otp || null,
          verifyUrl: verifyUrl || null
        }
      },
      req,
      res,
      startTime
    );
  },

  // 2. CHỨC NĂNG 2: POST /api/v1/password-reset (Đặt lại mật khẩu)
  passwordReset: async (req, res) => {
    const startTime = process.hrtime();
    const { to, name, resetUrl, expiresInMinutes, appName } = req.body;

    if (!to || !validator.isValidEmail(to)) {
      return res.status(400).json({ success: false, error: 'Địa chỉ email người nhận ("to") không hợp lệ.' });
    }

    if (!resetUrl) {
      return res.status(400).json({ success: false, error: 'Trường "resetUrl" (liên kết đặt lại mật khẩu) là bắt buộc.' });
    }

    const ttl = expiresInMinutes || 15;
    const rendered = templates.render('password-reset', {
      name: name || 'Bạn',
      resetUrl,
      expiresInMinutes: ttl,
      appName: appName || 'Auth Service'
    });

    return await dispatchEmail(
      {
        to,
        subject: req.body.subject || rendered.subject,
        html: rendered.html,
        text: `Yêu cầu đặt lại mật khẩu. Nhấn vào liên kết để tiếp tục (hết hạn trong ${ttl} phút): ${resetUrl}`,
        extra: {
          type: 'PASSWORD_RESET',
          resetUrl,
          expiresInMinutes: ttl
        }
      },
      req,
      res,
      startTime
    );
  },

  // 3. CHỨC NĂNG 3: POST /api/v1/send (Gửi mail tổng quát hoặc theo Template)
  sendMail: async (req, res) => {
    const startTime = process.hrtime();

    const validation = validator.validateSendPayload(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Dữ liệu không hợp lệ (Validation Error)',
        details: validation.errors
      });
    }

    let { to, subject, text, html, template, variables } = req.body;

    // Nếu người dùng chỉ định template có sẵn
    if (template) {
      try {
        const rendered = templates.render(template, variables || req.body);
        subject = subject || rendered.subject;
        html = rendered.html;
      } catch (err) {
        return res.status(400).json({ success: false, error: err.message });
      }
    }

    return await dispatchEmail({ to, subject, text, html }, req, res, startTime);
  },

  // GET /api/v1/templates (Lấy danh sách các mẫu HTML có sẵn)
  getTemplates: (req, res) => {
    return res.json({
      success: true,
      templates: templates.getSupportedTemplates()
    });
  },

  // GET /api/v1/queue/stats (Giám sát hàng đợi & Circuit Breaker)
  getQueueStats: (req, res) => {
    return res.json({
      success: true,
      queue: queue.getStats(),
      circuitBreaker: circuitBreaker.getStatus()
    });
  },

  // GET /api/v1/queue/dlq (Lấy danh sách thư hỏng trong Dead-Letter Queue)
  getDlq: (req, res) => {
    return res.json({
      success: true,
      data: queue.getDeadLetterQueue()
    });
  },

  // POST /api/v1/queue/dlq/:id/retry (Thử gửi lại một email trong DLQ)
  retryDlqJob: (req, res) => {
    const { id } = req.params;
    const retriedJob = queue.retryDeadLetterJob(id);
    if (!retriedJob) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy job trong Dead-Letter Queue.' });
    }
    return res.json({
      success: true,
      message: `Đã đưa job ${id} trở lại hàng đợi chính để thử gửi lại.`,
      job: retriedJob
    });
  },

  // DELETE /api/v1/queue/dlq (Xóa toàn bộ thư trong Dead-Letter Queue)
  clearDlq: (req, res) => {
    const count = queue.clearDeadLetterQueue();
    return res.json({ success: true, message: `Đã dọn dẹp ${count} job trong Dead-Letter Queue.` });
  },

  // GET /api/v1/mails (Lấy danh sách thư trong Sandbox)
  getMails: (req, res) => {
    return res.json({
      success: true,
      data: sandboxStore.getMails()
    });
  },

  // DELETE /api/v1/mails (Xóa sạch thư trong Sandbox)
  clearMails: (req, res) => {
    sandboxStore.clearMails();
    return res.json({ success: true, message: 'Đã dọn dẹp hòm thư Sandbox.' });
  }
};
