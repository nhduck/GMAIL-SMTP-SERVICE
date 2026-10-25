/**
 * Auth-Email-Service: Hybrid Email-as-a-Service Gateway
 * Entrypoint máy chủ chính tích hợp Graceful Shutdown & Dead-Letter Queue
 */

require('dotenv').config();
const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');

const mailController = require('./api/mail.controller');
const configController = require('./api/config.controller');
const imapListener = require('./core/imap-listener');
const webhookDispatcher = require('./core/webhook-dispatcher');
const queue = require('./core/queue');
const smtpLive = require('./core/smtp-live');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Cấu hình Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Phục vụ thư mục static (Dashboard & SDK)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/demo', express.static(path.join(__dirname, '../demo')));

// Cơ chế phát tin WebSocket Broadcast
function broadcastWs(payload) {
  const message = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  });
}
app.set('broadcastWs', broadcastWs);

// Đăng ký lắng nghe sự kiện Hàng đợi để phát ra Dashboard theo thời gian thực
queue.setEventListener((event) => {
  broadcastWs(event);
});

// REST API Routes
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    service: 'Auth-Email-Service (SOA Gateway)'
  });
});

// Core Assignment Endpoints (Account Verification, Password Reset, HTML Email Templates)
app.post('/api/v1/verify-email', mailController.verifyEmail);
app.post('/api/v1/password-reset', mailController.passwordReset);
app.get('/api/v1/templates', mailController.getTemplates);

// Mail Endpoints
app.post('/api/v1/send', mailController.sendMail);
app.get('/api/v1/mails', mailController.getMails);
app.delete('/api/v1/mails', mailController.clearMails);
app.get('/api/v1/queue/stats', mailController.getQueueStats);

// Dead-Letter Queue (DLQ) Endpoints
app.get('/api/v1/queue/dlq', mailController.getDlq);
app.post('/api/v1/queue/dlq/:id/retry', mailController.retryDlqJob);
app.delete('/api/v1/queue/dlq', mailController.clearDlq);

// Config Endpoints
app.get('/api/v1/config', configController.getConfig);
app.post('/api/v1/config/mode', configController.setMode);
app.post('/api/v1/config/credentials', configController.updateCredentials);

// WebSocket Connection Handler
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'CONNECTED', message: 'Kết nối WebSocket thành công tới Email Hub.' }));
});

// Khởi chạy IMAP Listener (Tính năng mở rộng - tắt mặc định để sinh viên cài đặt nhẹ và nhanh nhất)
if (process.env.ENABLE_INBOUND === 'true') {
  imapListener.startListening((newMail) => {
    broadcastWs({ type: 'INBOUND_MAIL', data: newMail });
    webhookDispatcher.dispatch(newMail);
  });
}

// Khởi động Server
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 [Email Gateway] Server đang chạy tại: http://localhost:${PORT}`);
    console.log(`🎛️  [Dashboard UI] Truy cập: http://localhost:${PORT}`);
    console.log(`🧪 [Trang Demo]   Truy cập: http://localhost:${PORT}/demo/index.html`);
    console.log(`📊 [Queue Stats]  Truy cập: http://localhost:${PORT}/api/v1/queue/stats`);
    console.log(`☠️  [DLQ Monitor] Truy cập: http://localhost:${PORT}/api/v1/queue/dlq`);
    console.log(`====================================================`);
  });
}

module.exports = { app, server };

// --- CƠ CHẾ GRACEFUL SHUTDOWN (TẮT MÁY CHỦ AN TOÀN) ---
let isShuttingDown = false;

async function handleShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n🛑 [Server] Nhận tín hiệu ${signal}. Đang thực hiện Graceful Shutdown...`);

  // 1. Ngừng nhận thêm request HTTP mới
  server.close(async () => {
    console.log('✓ [Server] Đã đóng cổng HTTP tiếp nhận.');

    try {
      // 2. Chờ các worker đang gửi dở hoàn thành nốt
      await queue.drainActiveWorkers(8000);

      // 3. Đóng connection pool SMTP và IMAP
      smtpLive.resetTransporter();
      await imapListener.stopListening();
      console.log('✓ [Server] Đã ngắt kết nối SMTP & IMAP an toàn.');

      // 4. Đóng toàn bộ client WebSocket
      wss.clients.forEach((client) => client.close());
      console.log('✓ [Server] Đã đóng toàn bộ kết nối WebSocket.');

      console.log('🎉 [Server] Toàn bộ tài nguyên đã giải phóng. Máy chủ dừng thành công!');
      process.exit(0);
    } catch (err) {
      console.error('[Shutdown Error]', err.message);
      process.exit(1);
    }
  });

  // Phòng hờ nếu bị treo quá 10 giây thì ép dừng
  setTimeout(() => {
    console.error('⚠️ [Server] Hết thời gian chờ 10s. Buộc dừng tiến trình.');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
