/**
 * Auth-Email-Service: Hybrid Email-as-a-Service Gateway
 * Entrypoint máy chủ chính
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

// REST API Routes
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    service: 'Auth-Email-Service (SOA Gateway)'
  });
});

app.post('/api/v1/send', mailController.sendMail);
app.get('/api/v1/mails', mailController.getMails);
app.delete('/api/v1/mails', mailController.clearMails);

app.get('/api/v1/config', configController.getConfig);
app.post('/api/v1/config/mode', configController.setMode);
app.post('/api/v1/config/credentials', configController.updateCredentials);

// WebSocket Connection Handler
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'CONNECTED', message: 'Kết nối WebSocket thành công tới Email Hub.' }));
});

// Khởi chạy IMAP Listener (khi nhận mail sẽ kích hoạt webhook & phát WebSocket)
imapListener.startListening((newMail) => {
  broadcastWs({ type: 'INBOUND_MAIL', data: newMail });
  webhookDispatcher.dispatch(newMail);
});

// Khởi động Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 [Email Gateway] Server đang chạy tại: http://localhost:${PORT}`);
  console.log(`🎛️  [Dashboard UI] Truy cập: http://localhost:${PORT}`);
  console.log(`🧪 [Trang Demo]   Truy cập: http://localhost:${PORT}/demo/index.html`);
  console.log(`====================================================`);
});
