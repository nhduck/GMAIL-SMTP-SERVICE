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
| **524H0032 - Trương Minh Thành** | Kiến trúc Backend, API Gateway, Hàng đợi Async Queue, Circuit Breaker, Template Engine | `src/server.js`, `src/api/mail.controller.js`, `src/core/templates.js`, `src/core/queue.js`, `src/core/smtp-live.js` |
| **524H0010 - Ngô Huỳnh Đức** | Tích hợp dịch vụ, Hướng dẫn thực hành, Postman Collection, Mô-đun mở rộng IMAP & SDK | `Auth-Email-Service.postman_collection.json`, `src/core/imap-listener.js` |
| **524H0008 - Lâm Tấn Đạt** | Dashboard UI, Hộp thư ảo, Ứng dụng mẫu Demo Auth (`demo/index.html`), Slide thuyết trình | `src/public/index.html`, `src/public/style.css`, `src/public/app.js`, `demo/index.html` |

## CÁCH CÀI ĐẶT & CHẠY THỬ & TEST THỬ

### Cách 1: Chạy Demo Toàn Luồng Nghiệp Vụ (Trang xin nghỉ phép của TMT Company)
Chỉ cần chạy 1 lệnh duy nhất hoặc click đúp file **`demo.bat`** trên Windows:
```bash
npm run demo
```
Lệnh sẽ khởi chạy đồng thời cả hai dịch vụ độc lập:
* **🏢 Portal Nhân viên (Cổng 4000):** [http://localhost:4000](http://localhost:4000) — Đăng ký tài khoản nhận OTP, đăng nhập, nộp đơn xin nghỉ phép, quên mật khẩu (TTL 5 phút).
* **📬 Hộp thư ảo Sandbox (Cổng 3000):** [http://localhost:3000](http://localhost:3000) — Xem email OTP, email Quản lý duyệt đơn và email kết quả trả về.

### Cách 2: Chạy Riêng Dịch Vụ Email Gateway (Cổng 3000)
Click đúp chuột vào file **`start.bat`** hoặc gõ lệnh:
```bash
npm start
```
* **Dashboard Quản Trị & Hộp thư ảo:** [http://localhost:3000](http://localhost:3000)

### Cách 3: Chạy Kiểm Thử Tự Động
```bash
npm run test:e2e    # Kiểm thử tự động 100% kịch bản xin nghỉ phép
npm test            # Kiểm thử 5 bộ chỉ tiêu SLA < 45ms, Queue, DLQ, Circuit Breaker
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

---

## CÁCH TÍCH HỢP VÀO DỰ ÁN KHÁC (API CONTRACT)

Dự án bất kỳ của các bạn (Node.js, Python, Java, PHP, C#) chỉ cần gọi 1 trong 3 endpoint sau:

### 1. Xác thực tài khoản (Account Verification)
> **Lưu ý:** Ở chế độ **Live Gmail**, ứng dụng nghiệp vụ tự sinh OTP (để lưu DB kiểm tra sau này) rồi truyền vào trường `otp` (hoặc truyền `verifyUrl`). Ở chế độ **Sandbox**, có thể bỏ trống để Gateway tự sinh ngẫu nhiên 6 số phục vụ nhóm mình demo nhanh.
```javascript
// Gửi mã OTP xác thực tài khoản
await fetch("http://localhost:3000/api/v1/verify-email", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    to: "student@tdtu.edu.vn",
    name: "Nguyễn Văn A",
    otp: "123456" // Ứng dụng tự sinh OTP (Sandbox có thể bỏ trống để tự sinh)
  })
});
```

### 2. Đặt lại mật khẩu (Password Reset)
```javascript
// Gửi email đặt lại mật khẩu kèm link có thời hạn an toàn 5 phút (mặc định)
await fetch("http://localhost:3000/api/v1/password-reset", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    to: "student@tdtu.edu.vn",
    name: "Nguyễn Văn A",
    resetUrl: "https://myapp.com/reset-password?token=sec_token_998811",
    expiresInMinutes: 5 // Tùy chọn: số nguyên từ 1 đến 1440 phút (mặc định 5 phút)
  })
});
```

### 3. Gửi HTML Email theo Template
```bash
curl -X POST http://localhost:3000/api/v1/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "student@tdtu.edu.vn",
    "template": "custom-html",
    "variables": {
      "title": "Chào mừng bạn đến với hệ thống!",
      "content": "<p>Tài khoản của bạn đã được kích hoạt thành công.</p>"
    }
  }'
```

### 4. Gửi Email Hành Động Tương Tác (Action Email - Nút Duyệt / Từ Chối)
```javascript
// Gửi email chứa bảng thông tin chi tiết và 2 nút hành động (Duyệt / Từ chối)
await fetch("http://localhost:3000/api/v1/send", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    to: "manager@demo.local",
    subject: "Đơn Xin Nghỉ Phép Cần Phê Duyệt",
    template: "action-email",
    variables: {
      title: "Đơn Xin Nghỉ Phép Cần Phê Duyệt",
      greeting: "Chào Quản lý,",
      intro: "Nhân viên Nguyễn Văn A vừa nộp một đơn xin nghỉ phép mới:",
      badge: { text: "CHỜ PHÊ DUYỆT", tone: "warning" },
      details: [
        { label: "Nhân viên", value: "Nguyễn Văn A (a@tdtu.edu.vn)" },
        { label: "Thời gian nghỉ", value: "Từ 05/11 đến 07/11 (3 ngày)" },
        { label: "Lý do", value: "Nghỉ phép cá nhân" }
      ],
      primaryButton: { text: "Duyệt Đơn", url: "http://localhost:4000/decision/token123?action=approve" },
      secondaryButton: { text: "Từ Chối", url: "http://localhost:4000/decision/token123?action=reject" }
    }
  })
});
```

---

## CẤU TRÚC THƯ MỤC DỰ ÁN

```text
Auth-Email-Service/
├── demo-app/                            # Ứng dụng xin nghỉ phép nghiệp vụ (TMT Company - Cổng 4000)
│   ├── public/                          # Giao diện web portal
│   │   ├── index.html                   # Portal nhân viên (Đăng ký OTP, Tạo đơn, Quên mật khẩu)
│   │   ├── decision.html                # Cổng xác nhận phê duyệt an toàn của Quản lý
│   │   └── style.css                    # CSS giao diện
│   ├── mailer.js                        # Client gọi Email Service Gateway qua chuẩn REST API
│   ├── server.js                        # Máy chủ nghiệp vụ Express (Cổng 4000)
│   └── store.js                         # In-memory store (Người dùng, OTP, Đơn nghỉ, Token 1 lần)
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
│   ├── config.js                        # Cấu hình tập trung (TTL 5 phút, API Key, Quota)
│   └── server.js                        # Điểm khởi chạy hệ thống (Express + WebSocket + Shutdown)
├── test/                                # Bộ kịch bản automation test
│   ├── demo-e2e.test.js                 # Test toàn luồng nghiệp vụ tự động (Sandbox E2E)
│   ├── queue-benchmark.test.js          # Benchmark 5 bài test cốt lõi (SLA, DLQ, Circuit Breaker)
│   └── stress-test.js                   # Stress test 100 requests đồng thời đo độ trễ
├── .env.example                         # Mẫu khai báo biến môi trường (GMAIL, TTL, API_KEY)
├── Auth-Email-Service.postman_collection.json # Bộ Postman Collection kiểm thử API
├── package.json                         # Quản lý thư viện và script thực thi
├── demo.bat                             # Script 1-click chạy đồng thời toàn bộ Demo (3000 & 4000)
├── start.bat                            # Script 1-click khởi chạy Email Gateway (Cổng 3000)
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