// Config Controller: Quản lý chế độ (Sandbox / Live) và cài đặt kết nối

const modeManager = require('../core/mode-manager');
const smtpLive = require('../core/smtp-live');
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
  setMode: (req, res) => {
    const { mode } = req.body;
    const ok = modeManager.setMode(mode);
    if (!ok) {
      return res.status(400).json({ success: false, error: 'Chế độ không hợp lệ. Chọn SANDBOX hoặc LIVE_GMAIL.' });
    }

    if (req.app.get('broadcastWs')) {
      req.app.get('broadcastWs')({ type: 'MODE_CHANGED', mode });
    }

    return res.json({ success: true, mode, isConfigured: modeManager.getConfig().isConfigured });
  },

  // POST /api/v1/config/credentials (Lưu email & App Password) - yêu cầu quyền quản trị
  updateCredentials: (req, res) => {
    const { user, appPassword, webhookUrl } = req.body;

    if (user && !validator.isValidEmail(user)) {
      return res.status(400).json({ success: false, error: 'Tài khoản Gmail không đúng định dạng email.' });
    }

    modeManager.updateCredentials({ user, appPassword, webhookUrl });
    smtpLive.resetTransporter();

    return res.json({
      success: true,
      message: 'Đã cập nhật cấu hình Gmail thành công.',
      data: modeManager.getConfig(true)
    });
  }
};
