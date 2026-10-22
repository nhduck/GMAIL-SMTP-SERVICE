/**
 * Mail Controller: Tiếp nhận gửi mail, kiểm tra validation RFC 5322,
 * đo SLA phản hồi < 45ms và quản lý Dead-Letter Queue (DLQ)
 * Thành viên phụ trách: Thành (Core Backend)
 */

const modeManager = require('../core/mode-manager');
const sandboxStore = require('../core/sandbox-store');
const queue = require('../core/queue');
const smtpLive = require('../core/smtp-live');
const circuitBreaker = require('../core/circuit-breaker');
const validator = require('../core/validator');

module.exports = {
  // POST /api/v1/send
  sendMail: async (req, res) => {
    const startTime = process.hrtime();

    // 1. Kiểm tra tính hợp lệ của Payload & định dạng email RFC 5322
    const validation = validator.validateSendPayload(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Dữ liệu không hợp lệ (Validation Error)',
        details: validation.errors
      });
    }

    const { to, subject, text, html } = req.body;
    const mode = modeManager.getMode();

    // 2. Chế độ SANDBOX (Dev Mode - Bắt mail tức thì vào RAM)
    if (mode === 'SANDBOX') {
      const saved = sandboxStore.addMail({ to, subject, text, html });

      // Phát sự kiện WebSocket ra Dashboard
      if (req.app.get('broadcastWs')) {
        req.app.get('broadcastWs')({ type: 'NEW_MAIL', data: saved });
      }

      // Tính thời gian phản hồi (SLA Benchmark)
      const diff = process.hrtime(startTime);
      const latencyMs = Math.round((diff[0] * 1000 + diff[1] / 1e6) * 100) / 100;
      res.setHeader('X-Response-Time-Ms', latencyMs);

      return res.status(202).json({
        success: true,
        message: 'Đã nhận yêu cầu gửi mail (Chế độ Sandbox).',
        mailId: saved.id,
        mode: 'SANDBOX',
        slaLatencyMs: latencyMs
      });
    }

    // 3. Chế độ LIVE_GMAIL
    // Kiểm tra trạng thái Circuit Breaker
    if (!circuitBreaker.canExecute()) {
      return res.status(503).json({
        success: false,
        error: 'Dịch vụ SMTP tạm ngưng để bảo vệ tài khoản (Circuit Breaker OPEN).',
        circuitBreaker: circuitBreaker.getStatus()
      });
    }

    // Đưa vào Hàng đợi xử lý bất đồng bộ (Non-blocking Queue)
    const enqueueResult = queue.enqueue(
      { to, subject, text, html },
      async () => {
        await smtpLive.sendLiveMail({ to, subject, text, html });
      }
    );

    // Tính thời gian phản hồi API (Chứng minh SLA < 45ms)
    const diff = process.hrtime(startTime);
    const latencyMs = Math.round((diff[0] * 1000 + diff[1] / 1e6) * 100) / 100;
    res.setHeader('X-Response-Time-Ms', latencyMs);

    return res.status(202).json({
      success: true,
      message: 'Đã tiếp nhận yêu cầu gửi Gmail (Đang xử lý trong hàng đợi).',
      jobId: enqueueResult.jobId,
      queueLength: enqueueResult.queueLength,
      mode: 'LIVE_GMAIL',
      slaLatencyMs: latencyMs
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
