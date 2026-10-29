// Webhook Dispatcher: Bắn payload JSON về các ứng dụng Client khi có thư đến (kèm xác thực X-Webhook-Secret)

const modeManager = require('./mode-manager');

module.exports = {
  dispatch: async (mailData) => {
    const webhookUrl = modeManager.getWebhookUrl();
    const webhookSecret = modeManager.getWebhookSecret();

    if (!webhookUrl) {
      console.log('[Webhook] Không có Webhook URL, bỏ qua phát sự kiện.');
      return { success: false, reason: 'NO_WEBHOOK_URL' };
    }

    const payload = {
      event: 'email.reply.received',
      timestamp: new Date().toISOString(),
      data: {
        messageId: mailData.messageId || `msg_${Date.now()}`,
        inReplyTo: mailData.inReplyTo || null,
        from: mailData.from || '',
        subject: mailData.subject || '',
        replyText: mailData.replyText || '',
        receivedAt: mailData.receivedAt || new Date().toISOString()
      }
    };

    console.log(`[Webhook] Đang phát sự kiện email.reply.received tới: ${webhookUrl} (from: ${payload.data.from}, subject: "${payload.data.subject}")`);

    const maxRetries = 2;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Secret': webhookSecret
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        const respBody = await res.json().catch(() => ({}));
        if (res.ok) {
          console.log(`✓ [Webhook] Bắn Webhook thành công (HTTP ${res.status}):`, respBody.message || 'OK');
          return { success: true, status: res.status, data: respBody };
        }

        console.warn(`[Webhook] Endpoint trả về lỗi HTTP ${res.status}:`, respBody.error || res.statusText);
        // Nếu lỗi 401 hoặc 400 thì không retry vô ích
        if (res.status === 401 || res.status === 400) {
          return { success: false, status: res.status, error: respBody.error };
        }
      } catch (err) {
        console.warn(`[Webhook Attempt ${attempt}] Lỗi kết nối tới ${webhookUrl}: ${err.message}`);
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 600));
        }
      }
    }

    return { success: false, error: 'WEBHOOK_DELIVERY_FAILED' };
  }
};
