# Auth-Email-Service: Hybrid Email-as-a-Service Gateway (SOA Architecture)

> **Môn học:** Kiến Trúc Hướng Dịch Vụ (Service-Oriented Architecture - SOA)  
> **Chủ đề Seminar:** Gmail SMTP & IMAP Service Hub chuẩn Plug & Play

---

## 🌟 Điểm Nhấn Cốt Lõi

1. **Dual-Mode (2 Chế Độ Trong 1):**
   - **🧪 Dev Sandbox (Mặc định):** 0-click khởi động. Gửi/nhận email ảo ngay trong RAM hiển thị trực tiếp lên Dashboard mà không cần tài khoản hay mật khẩu Gmail.
   - **🚀 Live Gmail (1-Click Toggle):** Gạt công tắc là chuyển thẳng sang kết nối thật với `smtp.gmail.com:587` (gửi) và `imap.gmail.com:993` (nhận thời gian thực).
2. **Tích Hợp 1 Dòng Chuẩn Bootstrap:**
   - Cung cấp Web Component `<mail-widget>`: Nhúng 1 thẻ HTML là có ngay form liên hệ Glassmorphism tuyệt đẹp.
3. **Hiệu Năng Cao (Non-blocking Queue):**
   - API trả về `202 Accepted` trong **< 45ms**, tách rời tiến trình gửi SMTP để không nghẽn luồng ứng dụng chính.
4. **Hệ Thống 2 Chiều Toàn Diện:**
   - Gửi qua SMTP (Outbound) và Nhận qua IMAP IDLE (Inbound) bắn Webhook JSON về các ứng dụng khác.

---

## 👥 Phân Chia Trách Nhiệm Nhóm 3 Người

| Thành viên | Trách nhiệm chính | File / Module phụ trách | Nhánh Git |
| :--- | :--- | :--- | :--- |
| **Thành** (Core Backend) | API Gateway, Dual-Mode Switcher, Message Queue, SMTP Live Pool (cổng 587) | `src/server.js`, `src/api/mail.controller.js`, `src/core/mode-manager.js`, `src/core/queue.js`, `src/core/smtp-live.js` | `feat/core-outbound` |
| **Đức** (Inbound & SDK) | IMAP IDLE Listener (cổng 993), MIME Parser, Webhook Dispatcher, Web Component `<mail-widget>`, Client SDK | `src/core/imap-listener.js`, `src/core/webhook-dispatcher.js`, `src/public/embed.js`, `src/public/mail-agent.min.js` | `feat/inbound-sdk` |
| **Đạt** (UI & Demo Lead) | Glassmorphism Dashboard, Live Virtual Mailbox Inspector, Snippet Generator, Demo Client App, Slide thuyết trình | `src/public/index.html`, `src/public/style.css`, `src/public/app.js`, `demo/index.html`, `start.bat` | `feat/dashboard-ui` |

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### Cách 1: Chạy 1 click (Windows)
Click đúp chuột vào file `start.bat`. Hệ thống sẽ tự động cài thư viện và mở trình duyệt.

### Cách 2: Chạy bằng Terminal
```bash
# 1. Cài đặt thư viện
npm install

# 2. Khởi động server
npm start
```
* **Dashboard Quản Trị:** [http://localhost:3000](http://localhost:3000)
* **Trang Demo Nhúng 1 Dòng:** [http://localhost:3000/demo/index.html](http://localhost:3000/demo/index.html)

---

## 💻 Hướng Dẫn Tích Hợp Vào Dự Án Khác

### 1. Nhúng Web Component (HTML)
```html
<script src="http://localhost:3000/embed.js"></script>
<mail-widget target="admin@cuahang.com" title="Liên Hệ Chúng Tôi"></mail-widget>
```

### 2. Dùng JavaScript SDK (Frontend)
```html
<script src="http://localhost:3000/mail-agent.min.js"></script>
<script>
  MailAgent.send({
    to: "user@example.com",
    subject: "OTP Code",
    html: "<b>123456</b>"
  });
</script>
```

### 3. Gọi REST API (Backend Node, Python, Java, PHP)
```bash
curl -X POST http://localhost:3000/api/v1/send \
  -H "Content-Type: application/json" \
  -d '{"to": "dev@example.com", "subject": "Test", "html": "Hello SOA"}'
```