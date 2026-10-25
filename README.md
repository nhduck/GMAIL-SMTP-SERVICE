# Auth-Email-Service: Email Service Integration (Gmail SMTP)

> **Học phần:** Kiến Trúc Hướng Dịch Vụ (SOA) – Khoa CNTT, Đại Học Tôn Đức Thắng (TDTU)  
> **Chủ đề Seminar:** **Email Service Integration (Gmail SMTP)**  
> **Trọng tâm đề bài:**
> 1. ✅ **Account Verification** (Xác thực tài khoản qua OTP hoặc Link kích hoạt)
> 2. ✅ **Password Reset** (Đặt lại mật khẩu qua liên kết có thời hạn an toàn 5 phút)
> 3. ✅ **HTML Email** (Mẫu email đồ họa Responsive, truyền biến động `{{name}}`, `{{otp}}`)

---

## 🌟 ĐIỂM NỔI BẬT DÀNH CHO SINH VIÊN

* **Khởi chạy tức thì ≤ 5 phút:** Mặc định chạy ở chế độ **`🧪 Dev Sandbox`** – không cần nhập tài khoản Gmail hay mật khẩu vẫn gửi và xem được email trực tiếp trên Web Dashboard.
* **Hiệu năng cao chuẩn Microservice:** Phản hồi ngay `202 Accepted` trong **< 45ms** (đo lường thực tế ~0.2ms) nhờ Hàng đợi phi khóa (Non-blocking Queue).
* **Độ tin cậy & Tự bảo vệ:** Tự động thử lại (**Exponential Backoff**), lưu thư lỗi vào **Dead-Letter Queue (DLQ)** và tự ngắt mạch (**Circuit Breaker**) chống bị Google khóa tài khoản.

---

## 👥 PHÂN CHIA TRÁCH NHIỆM NHÓM

| Thành viên | Trách nhiệm chính | Module phụ trách | Nhánh Git |
| :--- | :--- | :--- | :--- |
| **Nguyễn Thành** (Nhóm trưởng) | Kiến trúc Backend, API Gateway, Hàng đợi Async Queue, Circuit Breaker, Template Engine | `src/server.js`, `src/api/mail.controller.js`, `src/core/templates.js`, `src/core/queue.js`, `src/core/smtp-live.js` | `feat/core-outbound` |
| **Đức** (Thành viên) | Tích hợp dịch vụ, Hướng dẫn thực hành, Postman Collection, Mô-đun mở rộng IMAP & SDK | `docs/SEMINAR_PROPOSAL.md`, `Auth-Email-Service.postman_collection.json`, `src/core/imap-listener.js` | `feat/inbound-sdk` |
| **Đạt** (Thành viên) | Dashboard UI, Live Virtual Mailbox, Ứng dụng mẫu Demo Auth (`demo/index.html`), Slide thuyết trình | `src/public/index.html`, `src/public/style.css`, `src/public/app.js`, `demo/index.html` | `feat/dashboard-ui` |

---

## 🚀 HƯỚNG DẪN CÀI ĐẶT & CHẠY THỬ (≤ 5 PHÚT)

### Cách 1: Chạy 1-Click trên Windows (Khuyên dùng tại lớp)
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

## 🔑 HƯỚNG DẪN CẤU HÌNH GỬI THẬT QUA GMAIL (LIVE GMAIL MODE)

Khi cần gửi email thật ra ngoài hòm thư, bạn chỉ cần lấy **Mật khẩu ứng dụng (App Password 16 ký tự)** của Google:

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

## 💻 CÁCH TÍCH HỢP VÀO DỰ ÁN KHÁC (API CONTRACT)

Dự án bất kỳ của sinh viên (Node.js, Python, Java, PHP, C#) chỉ cần gọi 1 trong 3 endpoint sau:

### 1. Xác thực tài khoản (Account Verification)
> **Lưu ý:** Ở chế độ **Live Gmail**, ứng dụng nghiệp vụ tự sinh OTP (để lưu DB kiểm tra sau này) rồi truyền vào trường `otp` (hoặc truyền `verifyUrl`). Ở chế độ **Sandbox**, có thể bỏ trống để Gateway tự sinh ngẫu nhiên 6 số phục vụ demo nhanh.
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

## 🛠️ BẢNG XỬ LÝ LỖI THƯỜNG GẶP (TROUBLESHOOTING)

| Hiện tượng | Nguyên nhân | Cách khắc phục |
| :--- | :--- | :--- |
| **Lỗi `535 5.7.8 BadCredentials`** | Nhập mật khẩu đăng nhập bình thường thay vì App Password | Bật 2FA và tạo App Password 16 ký tự tại [Google App Passwords](https://myaccount.google.com/apppasswords). |
| **Gửi mail bị timeout trên mạng trường** | Wifi trường học hoặc Firewall công ty chặn cổng SMTP `587` | Chuyển sang 4G phát từ điện thoại hoặc sử dụng chế độ `🧪 Dev Sandbox` để kiểm thử an toàn. |
| **Circuit Breaker báo `OPEN`** | Gặp 5 lỗi liên tiếp (thường do sai mật khẩu) | Vào Tab Cấu hình kiểm tra lại App Password, sau đó Circuit Breaker sẽ tự phục hồi sau 30 giây. |

---

## ✨ TÍNH NĂNG MỞ RỘNG (EXTENSIONS)
*Các tính năng này nằm ngoài phạm vi chính của đề bài, được nhóm xây dựng thêm để nâng cao tính ứng dụng:*
- **IMAP IDLE Listener:** Lắng nghe thư đến thời gian thực qua cổng 993 và bắn Webhook JSON về các ứng dụng khác.
- **Web Component `<mail-widget>`:** Nhúng form liên hệ giao diện Glassmorphism chỉ bằng 1 thẻ HTML chuẩn Bootstrap (`<script src="http://localhost:3000/embed.js"></script>`).