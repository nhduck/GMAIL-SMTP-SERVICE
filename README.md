# Gmail-SMTP-Service: Email Service Integration (Gmail SMTP)

> **Chủ đề Seminar:** **Email Service Integration (Gmail SMTP)** 
> **Trọng tâm đề bài:**
> 1. **Account Verification** (Xác thực tài khoản qua OTP hoặc Link kích hoạt)
> 2. **Password Reset** (Đặt lại mật khẩu qua liên kết có thời hạn an toàn 5 phút)
> 3. **HTML Email** (Mẫu email đồ họa Responsive)

---

## BẢNG PHÂN CÔNG CÔNG VIỆC CỦA NHÓM SOA.26-38

| Thành viên | Trách nhiệm chính | Module phụ trách |
| :--- | :--- | :--- |
| **524H0032 - Trương Minh Thành** | Kiến trúc Backend, API Gateway, Hàng đợi Async Queue, Circuit Breaker, Template Engine | `src/server.js`, `src/api/mail.controller.js`, `src/core/templates.js`, `src/core/queue.js`, `src/core/smtp-live.js`, `src/core/security.js` |
| **524H0010 - Ngô Huỳnh Đức** | Tích hợp dịch vụ, Hướng dẫn thực hành, Postman Collection, Mô-đun mở rộng IMAP & SDK | `Gmail-SMTP-Service.postman_collection.json`, `src/core/imap-listener.js` |
| **524H0008 - Lâm Tấn Đạt** | Dashboard UI, Hộp thư ảo, Ứng dụng mẫu Demo Auth (`demo/index.html`), Slide thuyết trình | `src/public/index.html`, `src/public/style.css`, `src/public/app.js`, `demo/index.html` |

## CÁCH CÀI ĐẶT & CHẠY THỬ & TEST THỬ

### 1: Chạy Demo Toàn Luồng Nghiệp Vụ (Trang xin nghỉ phép của TMT Company)
Khởi chạy đồng thời cả hai dịch vụ độc lập (**Cổng 3000** Email Gateway & **Cổng 4000** Portal Nhân viên):
* **Trên Windows:** Click đúp chuột vào file **`demo.bat`** (hoặc gõ `npm run demo`).
* **Trên macOS / Ubuntu Linux:** Mở Terminal gõ **`bash demo.sh`** (hoặc `npm run demo`).
* **Qua Docker Compose (Tùy chọn cho môi trường không cài sẵn Node.js):**
  ```bash
  docker compose up -d
  ```

Sau khi khởi chạy, truy cập:
* **🏢 Portal Nhân viên (Cổng 4000):** [http://localhost:4000](http://localhost:4000) — Đăng ký tài khoản nhận OTP (TTL 5 phút), đăng nhập, nộp đơn xin nghỉ phép, quên mật khẩu (TTL 5 phút).
* **📬 Hộp thư ảo Sandbox (Cổng 3000):** [http://localhost:3000](http://localhost:3000) — Xem email OTP, email Quản lý duyệt đơn và email kết quả trả về.

### 2: Chạy Riêng Dịch Vụ Email Gateway (Cổng 3000)
* **Windows:** Click đúp file **`start.bat`** hoặc gõ `npm start`.
* **macOS / Linux:** Gõ **`bash start.sh`** hoặc `npm start`.
* **Dashboard Quản Trị & Hộp thư ảo:** [http://localhost:3000](http://localhost:3000)

### 3: Chạy Kiểm Thử Tự Động
```bash
npm run test:e2e    # Kiểm thử tự động 100% kịch bản xin nghỉ phép & bảo mật E2E
npm test            # Kiểm thử 5 bộ chỉ tiêu SLA < 45ms, Queue, DLQ, Circuit Breaker, Template XSS/URL
```

---

## HƯỚNG DẪN CẤU HÌNH GỬI QUA LIVE GMAIL

Khi cần gửi email thật ra ngoài hòm thư, các bạn chỉ cần lấy **Mật khẩu ứng dụng (App Password 16 ký tự)** của Google:

1. **Bước 1:** Bật xác minh 2 bước (**2-Step Verification**) cho tài khoản Google của bạn tại: [myaccount.google.com/security](https://myaccount.google.com/security).
2. **Bước 2:** Truy cập trực tiếp trang tạo mật khẩu ứng dụng: [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
3. **Bước 3:** Đặt tên ứng dụng (ví dụ: `SOA-Email-Service`) ➔ Bấm **Tạo** ➔ Google sẽ cấp một chuỗi 16 chữ cái (dạng `xxxx xxxx xxxx xxxx`).
4. **Bước 4:**
   - *Cách nhanh:* Mở Dashboard [http://localhost:3000](http://localhost:3000) ➔ Vào Tab **Cấu hình Gmail** ➔ Dán Email và chuỗi 16 ký tự ➔ Gạt công tắc sang **Live Gmail**.
   - *Hoặc qua file `.env`:* Copy file `.env.example` thành `.env` và điền:
     ```env
     MODE=LIVE_GMAIL
     GMAIL_USER=your_email@gmail.com
     GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
     ```

### Lộ trình B: Tự lập trình Email Service từ con số 0 (From Scratch - 10 phút)

Nếu các bạn muốn tự viết một dịch vụ gửi mail từ đầu để hiểu rõ bản chất kỹ thuật bên dưới `src/core/smtp-live.js`, `src/core/templates.js` và `demo-app/store.js`, hãy làm theo 4 bước sau:

#### Bước 1: Khởi tạo dự án Node.js mới & cài đặt thư viện
```bash
mkdir my-email-service && cd my-email-service
npm init -y
npm install express nodemailer dotenv
```

#### Bước 2: Tạo file `.env` khai báo thông tin kết nối Gmail SMTP
Tạo file `.env` trong thư mục `my-email-service`:
```env
PORT=3000
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
RESET_TTL_MINUTES=5
```

#### Bước 3: Viết toàn bộ logic cốt lõi trong 1 file `index.js`
Tạo file `index.js` (minh họa đầy đủ: **Nodemailer Connection Pool cổng 587 STARTTLS**, **sinh OTP an toàn bằng `crypto.randomInt`**, **Token đặt lại mật khẩu dùng 1 lần có TTL 5 phút**, và **HTML Email Responsive**):

```javascript
require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());

// 1. Khởi tạo SMTP Transporter kết nối Gmail qua cổng 587 (STARTTLS)
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // false = nâng cấp bảo mật qua STARTTLS trên cổng 587
  pool: true,    // Tái sử dụng kết nối TCP/TLS để tăng tốc độ gửi
  auth: {
    user: process.env.GMAIL_USER,
    pass: (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '')
  }
});

// Bộ nhớ tạm lưu OTP và Reset Token (Thực tế lưu trong Redis / Database)
const otpStore = new Map();   // email -> { otp, expiresAt, attempts }
const resetStore = new Map(); // token -> { email, expiresAt, used }

// Hàm chống XSS khi chèn biến vào HTML Email
const escapeHtml = (s = '') =>
  String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 2. API 1: Xác thực tài khoản qua OTP 6 số (Account Verification)
app.post('/api/verify-email', async (req, res) => {
  const { to, name = 'Bạn' } = req.body;
  // Sinh OTP 6 chữ số bằng CSPRNG (an toàn mật mã, không dùng Math.random)
  const otp = crypto.randomInt(100000, 1000000).toString();
  otpStore.set(to, { otp, expiresAt: Date.now() + 5 * 60 * 1000, attempts: 0 });

  const html = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px;font-family:sans-serif;">
      <tr><td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;padding:28px;border:1px solid #e2e8f0;">
          <tr><td>
            <h2 style="color:#1e40af;margin-top:0;">Xin chào ${escapeHtml(name)},</h2>
            <p>Mã xác thực tài khoản (OTP) của bạn là:</p>
            <div style="font-size:30px;font-weight:bold;letter-spacing:6px;text-align:center;padding:16px;background:#f1f5f9;border-radius:8px;">
              ${otp}
            </div>
            <p style="color:#64748b;font-size:13px;">Mã có hiệu lực trong vòng <b>5 phút</b>.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>`;

  await transporter.sendMail({
    from: `"SOA Lab Service" <${process.env.GMAIL_USER}>`,
    to,
    subject: 'Mã xác thực tài khoản (OTP)',
    text: `Mã OTP của bạn là: ${otp} (hiệu lực 5 phút).`,
    html
  });

  res.status(202).json({ success: true, message: 'Đã gửi OTP xác thực (TTL 5 phút).' });
});

// 3. API 2: Đặt lại mật khẩu với liên kết có thời hạn 5 phút (Password Reset)
app.post('/api/password-reset', async (req, res) => {
  const { to, name = 'Bạn' } = req.body;
  const ttlMinutes = Number(process.env.RESET_TTL_MINUTES) || 5;

  // Sinh token ngẫu nhiên 48 ký tự hex (24 bytes) dùng 1 lần
  const token = crypto.randomBytes(24).toString('hex');
  resetStore.set(token, {
    email: to,
    expiresAt: Date.now() + ttlMinutes * 60 * 1000,
    used: false
  });

  const resetUrl = `http://localhost:3000/api/confirm-reset?token=${token}`;
  const html = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px;font-family:sans-serif;">
      <tr><td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;padding:28px;border:1px solid #fecaca;">
          <tr><td>
            <h2 style="color:#dc2626;margin-top:0;">Yêu cầu đặt lại mật khẩu</h2>
            <p>Xin chào ${escapeHtml(name)}, nhấn vào nút bên dưới để đặt lại mật khẩu:</p>
            <p style="text-align:center;margin:24px 0;">
              <a href="${resetUrl}" style="background:#dc2626;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">
                Đặt Lại Mật Khẩu
              </a>
            </p>
            <p style="color:#991b1b;font-size:13px;">⚠️ Liên kết chỉ có hiệu lực trong <b>${ttlMinutes} phút</b> và chỉ dùng 1 lần.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>`;

  await transporter.sendMail({
    from: `"SOA Lab Service" <${process.env.GMAIL_USER}>`,
    to,
    subject: 'Khôi phục mật khẩu (Hiệu lực 5 phút)',
    text: `Đặt lại mật khẩu tại (hết hạn sau ${ttlMinutes} phút): ${resetUrl}`,
    html
  });

  res.status(202).json({ success: true, message: `Đã gửi link đặt lại mật khẩu (TTL ${ttlMinutes} phút).` });
});

app.listen(process.env.PORT || 3000, () => {
  console.log('Lab Email Service đang chạy tại http://localhost:3000');
});
```

#### Bước 4: Chạy thử và kiểm tra hòm thư
```bash
node index.js
```
Gửi thử bằng `curl` hoặc Postman:
```bash
curl -X POST http://localhost:3000/api/verify-email \
  -H "Content-Type: application/json" \
  -d '{"to": "your_receiver_email@gmail.com", "name": "Sinh Viên TDTU"}'
```

---
## CẤU TRÚC THƯ MỤC DỰ ÁN

```text
GmailSMTP/
├── demo-app/                            # Ứng dụng xin nghỉ phép nghiệp vụ (TMT Company - Cổng 4000)
│   ├── public/                          # Giao diện web portal
│   │   ├── index.html                   # Portal nhân viên (Đăng ký OTP, Tạo đơn, Quên mật khẩu)
│   │   ├── decision.html                # Cổng xác nhận phê duyệt an toàn của Quản lý
│   │   └── style.css                    # CSS giao diện
│   ├── mailer.js                        # Client gọi Email Service Gateway qua chuẩn REST API
│   ├── server.js                        # Máy chủ nghiệp vụ Express (Cổng 4000, có Rate Limiter)
│   └── store.js                         # In-memory store (Người dùng, OTP CSPRNG, Đơn nghỉ, Token 1 lần)
├── demo/                                # Form HTML Demo Auth trực tiếp từ trình duyệt (bản 6 fetch)
│   └── index.html                       # Demo Auth Client (bản 6 fetch)
├── scripts/                             # Kịch bản điều khiển hệ thống
│   └── run-demo.js                      # Chạy đồng thời Email Gateway & Demo App với log có tiền tố
├── src/                                 # Toàn bộ mã nguồn dịch vụ Email Gateway (Cổng 3000)
│   ├── api/                             # Tầng Controller tiếp nhận HTTP REST API
│   │   ├── config.controller.js         # API đổi chế độ Sandbox/Live & lưu tài khoản
│   │   └── mail.controller.js           # API verify-email, password-reset, send template
│   ├── core/                            # Tầng lõi nghiệp vụ và xử lý nền
│   │   ├── circuit-breaker.js           # Bộ ngắt mạch bảo vệ tài khoản Gmail chống spam
│   │   ├── mode-manager.js              # Quản lý trạng thái chuyển đổi Sandbox / Live Gmail
│   │   ├── queue.js                     # Hàng đợi phi khóa (Non-blocking), Retry & DLQ
│   │   ├── sandbox-store.js             # Hộp thư ảo lưu trữ email trên RAM ở Sandbox
│   │   ├── security.js                  # Bảo mật API Key (timing-safe) & bảo vệ API quản trị
│   │   ├── smtp-live.js                 # Pool kết nối SMTP gửi thư thật qua Gmail (cổng 587)
│   │   ├── templates.js                 # Template Engine render HTML Responsive (OTP, Reset 5m, Action)
│   │   ├── validator.js                 # Kiểm tra tính hợp lệ của email và dữ liệu đầu vào
│   │   ├── imap-listener.js             # (Mở rộng) Lắng nghe thư đến cổng 993 IMAP
│   │   └── webhook-dispatcher.js        # (Mở rộng) Bắn Webhook khi có thư đến
│   ├── public/                          # Giao diện Web Dashboard quản trị
│   │   ├── index.html                   # Giao diện Dashboard theo dõi hàng đợi & hộp thư ảo
│   │   ├── style.css                    # CSS giao diện Dark Mode / Modern Clean
│   │   ├── app.js                       # Logic tương tác Dashboard & WebSocket thời gian thực
│   │   ├── embed.js                     # (Mở rộng) Web Component <mail-widget>
│   │   └── mail-agent.min.js            # (Mở rộng) SDK nhúng nhanh vào client
│   ├── config.js                        # Cấu hình tập trung (TTL 5 phút, API Key, Sender Name)
│   └── server.js                        # Điểm khởi chạy hệ thống (Express + WebSocket + Shutdown)
├── test/                                # Bộ kịch bản automation test
│   ├── demo-e2e.test.js                 # Test toàn luồng nghiệp vụ tự động (Sandbox E2E)
│   ├── queue-benchmark.test.js          # Benchmark 5 bài test cốt lõi (SLA, DLQ, Circuit Breaker)
│   └── stress-test.js                   # Stress test 100 requests đồng thời đo độ trễ
├── .env.example                         # Mẫu khai báo biến môi trường (GMAIL, TTL, API_KEY)
├── .dockerignore                        # Danh sách loại trừ khi đóng gói Docker Image
├── Gmail-SMTP-Service.postman_collection.json # Bộ Postman Collection kiểm thử API
├── Dockerfile                           # Dockerfile đóng gói ứng dụng (Node 20 Alpine)
├── docker-compose.yml                   # Khởi chạy toàn bộ hệ thống bằng Docker Compose
├── package.json                         # Quản lý thư viện và script thực thi
├── demo.bat                             # Script 1-click chạy đồng thời toàn bộ Demo trên Windows
├── demo.sh                              # Script 1-click chạy đồng thời toàn bộ Demo trên macOS / Linux
├── start.bat                            # Script 1-click khởi chạy Email Gateway trên Windows
├── start.sh                             # Script 1-click khởi chạy Email Gateway trên macOS / Linux
└── README.md                            # Hướng dẫn sử dụng và tài liệu kỹ thuật
```
---

## BẢNG XỬ LÝ LỖI THƯỜNG GẶP

| Hiện tượng | Nguyên nhân | Cách khắc phục |
| :--- | :--- | :--- |
| **Lỗi `535 5.7.8 BadCredentials`** | Nhập mật khẩu đăng nhập bình thường thay vì App Password | Bật 2FA và tạo App Password 16 ký tự tại [Google App Passwords](https://myaccount.google.com/apppasswords). |
| **Gửi mail bị timeout trên mạng trường** | Wifi trường học hoặc Firewall công ty chặn cổng SMTP `587` | Chuyển sang 4G phát từ điện thoại hoặc sử dụng chế độ Sandbox để kiểm thử an toàn. |
| **Circuit Breaker báo `OPEN`** | Gặp 5 lỗi liên tiếp (thường do sai mật khẩu) | Vào Tab Cấu hình kiểm tra lại App Password, sau đó Circuit Breaker sẽ tự phục hồi sau 30 giây. |

---

## TÍNH NĂNG MỞ RỘNG (NHÓM MÌNH TẮT MẶC ĐỊNH)
*Lưu ý: Các tính năng này nằm ngoài phạm vi chính của đề tài (được tắt mặc định để đảm bảo cài đặt nhẹ và nhanh nhất cho các bạn, bản đầy đủ đã được lưu trữ tại Git tag `full-version`):*
- **IMAP IDLE Listener (Tắt mặc định):** Lắng nghe thư đến thời gian thực qua cổng 993 và bắn Webhook JSON về các ứng dụng khác (kích hoạt bằng biến `ENABLE_INBOUND=true` trong `.env`).
- **Web Component `<mail-widget>` & SDK:** Nhúng form liên hệ giao diện Glassmorphism chỉ bằng 1 thẻ HTML (`<script src="http://localhost:3000/embed.js"></script>`).

> **Học phần:** Kiến Trúc Hướng Dịch Vụ (SOA) – Khoa CNTT, Đại Học Tôn Đức Thắng (TDTU)
