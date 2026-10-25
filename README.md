# Auth-Email-Service: Email Service Integration (Gmail SMTP)

> **Học phần:** Kiến Trúc Hướng Dịch Vụ (SOA) – Khoa CNTT, Đại Học Tôn Đức Thắng (TDTU)  
> **Chủ đề Seminar:** **Email Service Integration (Gmail SMTP)**  
> **Trọng tâm đề bài:**
> 1. **Account Verification** (Xác thực tài khoản qua OTP hoặc Link kích hoạt)
> 2. **Password Reset** (Đặt lại mật khẩu qua liên kết có thời hạn an toàn 5 phút)
> 3. **HTML Email** (Mẫu email đồ họa Responsive, truyền biến động `{{name}}`, `{{otp}}`)

---

## ĐIỂM NỔI BẬT

* **Khởi chạy tức thì:** Mặc định chạy ở chế độ **`Dev Sandbox`** – không cần nhập tài khoản Gmail hay mật khẩu vẫn gửi và xem được email trực tiếp trên Web Dashboard.
* **Hiệu năng cao chuẩn Microservice:** Phản hồi ngay `202 Accepted` trong **< 45ms** (đo lường thực tế ~0.2ms) nhờ Hàng đợi phi khóa (Non-blocking Queue).
* **Độ tin cậy & Tự bảo vệ:** Tự động thử lại (**Exponential Backoff**), lưu thư lỗi vào **Dead-Letter Queue (DLQ)** và tự ngắt mạch (**Circuit Breaker**) chống bị Google khóa tài khoản.

---

## PHÂN CHIA CÔNG VIỆC NHÓM

| Thành viên | Trách nhiệm chính | Module phụ trách | Nhánh Git |
| :--- | :--- | :--- | :--- |
| **524H0032 - Trương Minh Thành** (Nhóm trưởng) | Kiến trúc Backend, API Gateway, Hàng đợi Async Queue, Circuit Breaker, Template Engine | `src/server.js`, `src/api/mail.controller.js`, `src/core/templates.js`, `src/core/queue.js`, `src/core/smtp-live.js` | `feat/core-outbound` |
| **524H0032 - Ngô Huỳnh Đức** (Thành viên) | Tích hợp dịch vụ, Hướng dẫn thực hành, Postman Collection, Mô-đun mở rộng IMAP & SDK, `Auth-Email-Service.postman_collection.json`, `src/core/imap-listener.js` | `feat/inbound-sdk` |
| **524H0008 - Lâm Tấn Đạt** (Thành viên) | Dashboard UI, Live Virtual Mailbox, Ứng dụng mẫu Demo Auth (`demo/index.html`), Slide thuyết trình | `src/public/index.html`, `src/public/style.css`, `src/public/app.js`, `demo/index.html` | `feat/dashboard-ui` |

---

## CẤU TRÚC THƯ MỤC DỰ ÁN

```text
Auth-Email-Service/
├── demo/                                # Ứng dụng web mẫu minh họa tích hợp
│   └── index.html                       # Demo Auth Client (Đăng ký OTP & Quên mật khẩu)
├── src/                                 # Toàn bộ mã nguồn dịch vụ Email Gateway
│   ├── api/                             # Tầng Controller tiếp nhận HTTP REST API
│   │   ├── config.controller.js         # API đổi chế độ Sandbox/Live & lưu tài khoản
│   │   └── mail.controller.js           # API verify-email, password-reset, send template
│   ├── core/                            # Tầng lõi nghiệp vụ và xử lý nền
│   │   ├── circuit-breaker.js           # Bộ ngắt mạch bảo vệ tài khoản Gmail chống spam
│   │   ├── mode-manager.js              # Quản lý trạng thái chuyển đổi Sandbox / Live Gmail
│   │   ├── queue.js                     # Hàng đợi phi khóa (Non-blocking), Retry & DLQ
│   │   ├── sandbox-store.js             # Hộp thư ảo lưu trữ email trên RAM ở Sandbox
│   │   ├── smtp-live.js                 # Pool kết nối SMTP gửi thư thật qua Gmail (cổng 587)
│   │   ├── templates.js                 # Template Engine render HTML Responsive cho 3 use case
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
├── test/                                # Bộ kịch bản kiểm thử tự động
│   ├── queue-benchmark.test.js          # Benchmark 5 bài test cốt lõi (SLA, DLQ, Circuit Breaker)
│   └── stress-test.js                   # Stress test 100 requests đồng thời đo độ trễ
├── .env.example                         # Mẫu khai báo biến môi trường (GMAIL, TTL, API_KEY)
├── Auth-Email-Service.postman_collection.json # Bộ sưu tập Postman Collection kiểm thử API
├── package.json                         # Quản lý thư viện và script thực thi
├── start.bat                            # Script 1-click khởi chạy tức thì trên Windows
└── README.md                            # Hướng dẫn sử dụng và tài liệu kỹ thuật
```

---

## CÁCH CÀI ĐẶT & CHẠY THỬ

### Cách 1: Chạy 1-Click trên Windows
1. Clone mã nguồn về máy:
   ```bash
   git clone https://github.com/nhduck/Auth-Email-Service.git
   cd Auth-Email-Service
   ```
2. Click đúp chuột vào file **`start.bat`**.  
   *Hệ thống sẽ tự động cài gói thư viện và mở trình duyệt tại [http://localhost:3000](http://localhost:3000).*

### Cách 2: Chạy bằng dòng lệnh (Terminal)
```bash
npm install
npm start
```
* **Dashboard Quản Trị & Hộp thư ảo:** [http://localhost:3000](http://localhost:3000)
* **Ứng Dụng Mẫu (Demo App Auth):** [http://localhost:3000/demo/index.html](http://localhost:3000/demo/index.html)

---

## HƯỚNG DẪN CẤU HÌNH GỬI THẬT QUA GMAIL (LIVE GMAIL MODE)

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

---

## BẢNG XỬ LÝ LỖI THƯỜNG GẶP

| Hiện tượng | Nguyên nhân | Cách khắc phục |
| :--- | :--- | :--- |
| **Lỗi `535 5.7.8 BadCredentials`** | Nhập mật khẩu đăng nhập bình thường thay vì App Password | Bật 2FA và tạo App Password 16 ký tự tại [Google App Passwords](https://myaccount.google.com/apppasswords). |
| **Gửi mail bị timeout trên mạng trường** | Wifi trường học hoặc Firewall công ty chặn cổng SMTP `587` | Chuyển sang 4G phát từ điện thoại hoặc sử dụng chế độ Sandbox để kiểm thử an toàn. |
| **Circuit Breaker báo `OPEN`** | Gặp 5 lỗi liên tiếp (thường do sai mật khẩu) | Vào Tab Cấu hình kiểm tra lại App Password, sau đó Circuit Breaker sẽ tự phục hồi sau 30 giây. |

---

## TÍNH NĂNG MỞ RỘNG (TẮT MẶC ĐỊNH)
*Lưu ý: Các tính năng này nằm ngoài phạm vi chính của đề tài (được tắt mặc định để đảm bảo cài đặt nhẹ và nhanh nhất cho sinh viên, bản đầy đủ đã được lưu trữ tại Git tag `full-version`):*
- **IMAP IDLE Listener (Tắt mặc định):** Lắng nghe thư đến thời gian thực qua cổng 993 và bắn Webhook JSON về các ứng dụng khác (kích hoạt bằng biến `ENABLE_INBOUND=true` trong `.env`).
- **Web Component `<mail-widget>` & SDK:** Nhúng form liên hệ giao diện Glassmorphism chỉ bằng 1 thẻ HTML (`<script src="http://localhost:3000/embed.js"></script>`).