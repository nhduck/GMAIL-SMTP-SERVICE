/**
 * Config Controller: Quản lý chế độ (Sandbox / Live) và cài đặt kết nối
 * Thành viên phụ trách: Thành viên 1 & 3
 */

const modeManager = require('../core/mode-manager');
const smtpLive = require('../core/smtp-live');

module.exports = {
  // GET /api/v1/config
  getConfig: (req, res) => {
    return res.json({
      success: true,
      data: modeManager.getConfig()
    });
  },

  // POST /api/v1/config/mode (Chuyển chế độ hoạt động)
  setMode: (req, res) => {
    const { mode } = req.body;
    const ok = modeManager.setMode(mode);
    if (!ok) {
      return res.status(400).json({ error: 'Chế độ không hợp lệ. Chọn SANDBOX hoặc LIVE_GMAIL.' });
    }

    if (req.app.get('broadcastWs')) {
      req.app.get('broadcastWs')({ type: 'MODE_CHANGED', mode });
    }

    return res.json({ success: true, mode });
  },

  // POST /api/v1/config/credentials (Lưu email & App Password)
  updateCredentials: (req, res) => {
    const { user, appPassword, webhookUrl } = req.body;
    modeManager.updateCredentials({ user, appPassword, webhookUrl });
    smtpLive.resetTransporter();

    return res.json({
      success: true,
      message: 'Đã cập nhật cấu hình Gmail thành công.',
      data: modeManager.getConfig()
    });
  }
};
