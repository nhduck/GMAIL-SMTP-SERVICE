/**
 * Mail Controller: Tiếp nhận yêu cầu gửi mail và truy vấn danh sách mail
 * Thành viên phụ trách: Thành viên 1
 */

const modeManager = require('../core/mode-manager');
const sandboxStore = require('../core/sandbox-store');
const queue = require('../core/queue');
const smtpLive = require('../core/smtp-live');

module.exports = {
  // POST /api/v1/send
  sendMail: async (req, res) => {
    const { to, subject, text, html } = req.body;
    if (!to) {
      return res.status(400).json({ error: 'Trường "to" (email người nhận) là bắt buộc.' });
    }

    const mode = modeManager.getMode();

    if (mode === 'SANDBOX') {
      // Chế độ Sandbox: Bắt email ngay lập tức và lưu vào virtual inbox
      const saved = sandboxStore.addMail({ to, subject, text, html });

      // Phát sự kiện WebSocket ra Dashboard
      if (req.app.get('broadcastWs')) {
        req.app.get('broadcastWs')({ type: 'NEW_MAIL', data: saved });
      }

      return res.status(202).json({
        success: true,
        message: 'Đã nhận yêu cầu gửi mail (Chế độ Sandbox).',
        mailId: saved.id,
        mode: 'SANDBOX'
      });
    }

    // Chế độ LIVE_GMAIL: Đưa vào Queue để đạt SLA < 45ms
    const taskId = Date.now().toString();
    queue.enqueue({
      id: taskId,
      handler: async () => {
        await smtpLive.sendLiveMail({ to, subject, text, html });
      }
    });

    return res.status(202).json({
      success: true,
      message: 'Đã đưa vào hàng đợi gửi Gmail.',
      jobId: taskId,
      mode: 'LIVE_GMAIL'
    });
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
