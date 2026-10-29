/**
 * scripts/run-demo.js
 * Khởi chạy đồng thời Email Service (Cổng 3000) và Ứng Dụng Nghỉ Phép (Cổng 4000)
 * Hai tiến trình độc lập (Decoupled Microservices), log có tiền tố [email] và [app]
 * Tự động tạo và chia sẻ WEBHOOK_SECRET cho cả hai tiến trình
 */

const { spawn } = require('child_process');
const path = require('path');
const crypto = require('crypto');

const rootDir = path.resolve(__dirname, '..');
const sharedWebhookSecret = process.env.WEBHOOK_SECRET || ('sec_' + crypto.randomBytes(12).toString('hex'));
const sharedWebhookUrl = process.env.WEBHOOK_URL || 'http://localhost:4000/api/webhook/email-reply';

console.log(' ĐANG KHỞI ĐỘNG HỆ THỐNG DEMO DUYỆT ĐƠN NGHỈ PHÉP CỦA TMT COMPANY (HAI CHIỀU SMTP & IMAP)');

// 1. Khởi động Email Gateway (Cổng 3000)
const emailProc = spawn(process.execPath, [path.join(rootDir, 'src', 'server.js')], {
  cwd: rootDir,
  env: {
    ...process.env,
    PORT: '3000',
    WEBHOOK_URL: sharedWebhookUrl,
    WEBHOOK_SECRET: sharedWebhookSecret
  },
  stdio: ['pipe', 'pipe', 'pipe']
});

// 2. Khởi động Demo Leave App (Cổng 4000)
const appProc = spawn(process.execPath, [path.join(rootDir, 'demo-app', 'server.js')], {
  cwd: rootDir,
  env: {
    ...process.env,
    DEMO_PORT: '4000',
    SERVICE_URL: 'http://localhost:3000',
    DEMO_APP_URL: process.env.DEMO_APP_URL || 'http://localhost:4000',
    WEBHOOK_SECRET: sharedWebhookSecret
  },
  stdio: ['pipe', 'pipe', 'pipe']
});

function pipeOutput(proc, prefix, colorCode) {
  proc.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        console.log(`\x1b[${colorCode}m[${prefix}]\x1b[0m ${line}`);
      }
    }
  });

  proc.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        console.error(`\x1b[31m[${prefix}:ERR]\x1b[0m ${line}`);
      }
    }
  });
}

// 36 = Cyan, 35 = Magenta
pipeOutput(emailProc, 'email-service:3000', '36');
pipeOutput(appProc, 'leave-app:4000', '35');

// In bảng hướng dẫn truy cập
setTimeout(() => {
  console.log(' CẢ 2 DỊCH VỤ ĐÃ KHỞI CHẠY THÀNH CÔNG!');
  console.log(' 1. Giao diện Nhân viên (Tạo đơn, nhận OTP):');
  console.log('      http://localhost:4000');
  console.log(' 2. Hộp thư ảo Sandbox (Xem email OTP, email Duyệt đơn, bấm "Trả lời thư"):');
  console.log('      http://localhost:3000');
  console.log(' 3. Tài khoản Quản lý nhận email mẫu:');
  console.log(`      ${process.env.MANAGER_EMAIL || 'manager@demo.local'}`);
}, 1200);

// Xử lý dừng máy chủ an toàn khi nhận tín hiệu tắt (Ctrl + C)
function killProcesses() {
  console.log('\n Đang dừng cả hai dịch vụ...');
  try { emailProc.kill(); } catch (_) { }
  try { appProc.kill(); } catch (_) { }
  setTimeout(() => process.exit(0), 500);
}

process.on('SIGINT', killProcesses);
process.on('SIGTERM', killProcesses);
emailProc.on('exit', () => killProcesses());
appProc.on('exit', () => killProcesses());
