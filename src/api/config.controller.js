// Config Controller: Quản lý chế độ (Sandbox / Live) và cài đặt kết nối

const modeManager = require('../core/mode-manager');
const smtpLive = require('../core/smtp-live');
const imapService = require('../core/imap-service');
const validator = require('../core/validator');
const { isAdminRequest } = require('../core/security');

module.exports = {
  // GET /api/v1/config
  // Công khai: chỉ trả email đã che. Request quản trị (localhost / API Key) mới thấy email đầy đủ.
  getConfig: (req, res) => {
    return res.json({
      success: true,
      data: modeManager.getConfig(isAdminRequest(req))
    });
  },

  // POST /api/v1/config/mode (Chuyển chế độ hoạt động) - yêu cầu quyền quản trị
  setMode: async (req, res) => {
    const { mode } = req.body;
    const ok = modeManager.setMode(mode);
    if (!ok) {
      return res.status(400).json({ success: false, error: 'Chế độ không hợp lệ. Chọn SANDBOX hoặc LIVE_GMAIL.' });
    }

    if (req.app.get('broadcastWs')) {
      req.app.get('broadcastWs')({ type: 'MODE_CHANGED', mode });
    }

    // Tự động đồng bộ dịch vụ IMAP Listener theo chế độ hoạt động
    try {
      await imapService.syncWithMode(mode);
    } catch (imapErr) {
      console.warn('[IMAP Sync Warning]', imapErr.message);
    }

    return res.json({ success: true, mode, isConfigured: modeManager.getConfig().isConfigured });
  },

  // POST /api/v1/config/credentials (Lưu email & App Password) - yêu cầu quyền quản trị
  updateCredentials: async (req, res) => {
    const { user, appPassword, webhookUrl, webhookSecret } = req.body;

    if (user && !validator.isValidEmail(user)) {
      return res.status(400).json({ success: false, error: 'Tài khoản Gmail không đúng định dạng email.' });
    }

    // Kiểm tra định dạng Google App Password (16 ký tự chữ cái sau khi bỏ khoảng trắng)
    // Tránh trường hợp trình duyệt tự động điền (autofill) mật khẩu đăng nhập thường làm hỏng App Password trong .env
    if (appPassword && String(appPassword).trim().length > 0) {
      const cleanedPass = String(appPassword).replace(/\s+/g, '');
      if (!/^[a-zA-Z]{16}$/.test(cleanedPass)) {
        return res.status(400).json({
          success: false,
          error: 'App Password không hợp lệ! Mật khẩu ứng dụng Google phải gồm đúng 16 chữ cái (dạng xxxx xxxx xxxx xxxx), không phải mật khẩu đăng nhập Gmail thường.'
        });
      }
    }

    modeManager.updateCredentials({ user, appPassword, webhookUrl, webhookSecret });
    smtpLive.resetTransporter();

    // Khởi động lại dịch vụ IMAP nếu đang ở chế độ LIVE_GMAIL
    try {
      if (modeManager.getMode() === 'LIVE_GMAIL') {
        await imapService.syncWithMode('LIVE_GMAIL');
      }
    } catch (imapErr) {
      console.warn('[IMAP Restart Warning]', imapErr.message);
    }

    return res.json({
      success: true,
      message: 'Đã cập nhật cấu hình Gmail thành công.',
      data: modeManager.getConfig(true)
    });
  }
};
