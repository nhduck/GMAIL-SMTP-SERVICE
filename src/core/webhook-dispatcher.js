/**
 * Webhook Dispatcher: Bắn payload JSON về các ứng dụng Client khi có thư đến
 * Thành viên phụ trách: Thành viên 2
 */

const modeManager = require('./mode-manager');

module.exports = {
  dispatch: async (mailData) => {
    const { webhookUrl } = modeManager.getConfig();
    if (!webhookUrl) return;

    try {
      console.log(`[Webhook] Đang gửi thông báo tới ${webhookUrl}...`);
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'email.received',
          timestamp: new Date().toISOString(),
          data: mailData
        })
      });
      console.log('[Webhook] Bắn Webhook thành công!');
    } catch (err) {
      console.error('[Webhook Error]', err.message);
    }
  }
};
