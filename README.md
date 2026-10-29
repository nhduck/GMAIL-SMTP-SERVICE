# Gmail-SMTP-Service: Email Service Integration (Gmail SMTP & IMAP Hai Chiều)

> **Chủ đề Seminar:** **Email Service Integration (Gmail SMTP)** 
> **Trọng tâm đề bài & Kiến trúc nâng cấp:**
> 1. **Account Verification** (Xác thực tài khoản qua OTP 6 số an toàn bằng CSPRNG, hiệu lực 5 phút)
> 2. **Password Reset** (Đặt lại mật khẩu qua liên kết có thời hạn an toàn 5 phút, tự hủy token cũ và session cũ)
> 3. **HTML Email Templates** (Mẫu email đồ họa Responsive thích ứng mọi kích thước màn hình Desktop và Mobile 375px)
> 4. **Phê Duyệt Đơn Hai Chiều (Bidirectional Email Processing: Outbound SMTP + Inbound IMAP Reply)**: Quản lý nhận email và bấm **Reply** trực tiếp trong ứng dụng Gmail với nội dung *"Duyệt"* hoặc *"Từ chối"* mà không cần rời ứng dụng email. Hệ thống lắng nghe qua **IMAP IDLE**, làm sạch trích dẫn thư cũ, và bắn **Webhook** cập nhật trạng thái đơn tức thì!

---

## BẢNG PHÂN CÔNG CÔNG VIỆC CỦA NHÓM SOA.26-38

| Thành viên | Trách nhiệm chính | Module phụ trách |
| :--- | :--- | :--- |
| **524H0032 - Trương Minh Thành** | Kiến trúc Backend, API Gateway, Hàng đợi Async Queue, Circuit Breaker, Template Engine Responsive | `src/server.js`, `src/api/mail.controller.js`, `src/core/templates.js`, `src/core/queue.js`, `src/core/smtp-live.js`, `src/core/security.js` |
| **524H0010 - Ngô Huỳnh Đức** | Tích hợp dịch vụ hai chiều, Bộ làm sạch trích dẫn thư Reply, IMAP IDLE Listener, Webhook Dispatcher & Consumer | `src/core/text-cleaner.js`, `src/core/imap-listener.js`, `src/core/imap-service.js`, `src/core/webhook-dispatcher.js`, `demo-app/server.js` |
| **524H0008 - Lâm Tấn Đạt** | Dashboard UI, Hộp thư ảo, Khung xem trước Responsive (Desktop/Mobile), Nút Trả lời thư Sandbox, Slide thuyết trình | `src/public/index.html`, `src/public/style.css`, `src/public/app.js`, `demo/index.html` |

---

## KIẾN TRÚC TƯƠNG TÁC HAI CHIỀU (TWO-WAY EMAIL PROCESSING IN SOA)

Hệ thống được thiết kế theo đúng nguyên lý **Loose Coupling (Ràng buộc lỏng lẻo)** của SOA:
* **Email Gateway (Cổng 3000):** Đóng vai trò thuần túy về hạ tầng Email (gửi qua SMTP, đọc qua IMAP, cắt bỏ khối trích dẫn thư cũ, chống trùng `Message-ID`, và phát sự kiện Webhook). Gateway không phụ thuộc nghiệp vụ Nghỉ phép.
* **Leave App (Cổng 4000):** Đóng vai trò Ứng dụng nghiệp vụ độc lập (tạo đơn, bóc tách mã đơn `#lv_[a-f0-9]{12}`, kiểm tra người gửi chính xác, phân tích ranh giới từ `\b` phê duyệt/từ chối, và cập nhật trạng thái đơn).

```
[Nhân viên tạo đơn] ──HTTP POST──> [Leave App :4000] ──REST API──> [Email Gateway :3000] ──SMTP (Port 587)──> [Gmail Quản lý]
                                           ▲                                                                   │
                                           │                                                             (Bấm Reply: "Duyệt")
                                           │                                                                   │
                                     Webhook POST                                                              ▼
                                  (X-Webhook-Secret) <──── [Email Gateway :3000] <───IMAP IDLE (Port 993)──────┘
                                           │              (Cắt trích dẫn thư cũ)
                                           ▼
                                 [Cập nhật APPROVED]
                                           │
                                  ──Gửi kết quả (SMTP)──> [Gmail Nhân viên]
```

---

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
* **🏢 Portal Nhân viên (Cổng 4000):** [http://localhost:4000](http://localhost:4000) — Đăng ký tài khoản nhận OTP (TTL 5 phút), đăng nhập, nộp đơn xin nghỉ phép, theo dõi lịch sử duyệt đơn thời gian thực.
* **📬 Hộp thư ảo Sandbox (Cổng 3000):** [http://localhost:3000](http://localhost:3000) — Xem email OTP, email Quản lý duyệt đơn và bấm nút **"Trả lời thư"** để mô phỏng Quản lý Reply ngay trong Sandbox!

### 2: Chạy Riêng Dịch Vụ Email Gateway (Cổng 3000)
* **Windows:** Click đúp file **`start.bat`** hoặc gõ `npm start`.
* **macOS / Linux:** Gõ **`bash start.sh`** hoặc `npm start`.
* **Dashboard Quản Trị & Hộp thư ảo:** [http://localhost:3000](http://localhost:3000)

### 3: Chạy Kiểm Thử Tự Động
```bash
npm run test:e2e    # Kiểm thử tự động 100% kịch bản xin nghỉ phép, xác thực OTP, Reply Duyệt/Từ chối, chống Replay & bảo mật Webhook
npm test            # Kiểm thử 5 bộ chỉ tiêu SLA < 45ms, Queue, DLQ, Circuit Breaker, Template XSS/URL
```

---

## HƯỚNG DẪN CẤU HÌNH LIVE GMAIL & PHÊ DUYỆT BẰNG EMAIL THẬT

### Yêu cầu chuẩn bị tài khoản khi Demo Live:
> ⚠️ **Lưu ý quan trọng:** Để tránh vòng lặp tự gửi - tự nhận (Email Loopback), khi demo Live cần **2 tài khoản Gmail khác nhau**:
> 1. **Tài khoản Bot Dịch Vụ (`GMAIL_USER`):** Dùng để gửi thư tự động qua SMTP và lắng nghe thư đến qua IMAP.
> 2. **Tài khoản Quản lý (`MANAGER_EMAIL`):** Dùng để nhận email xin nghỉ và bấm **Reply** trực tiếp trên app Gmail của điện thoại / máy tính.

### Các bước lấy App Password & bật IMAP cho tài khoản Bot:
1. **Bật xác minh 2 bước:** Truy cập [myaccount.google.com/security](https://myaccount.google.com/security) và bật 2-Step Verification.
2. **Tạo App Password 16 ký tự:** Truy cập [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords), đặt tên `SOA-Email-Service` ➔ Tạo ➔ Nhận chuỗi 16 chữ cái.
3. **Bật tính năng IMAP trong Gmail:**
   - Mở Gmail trên trình duyệt ➔ Bấm biểu tượng bánh răng **Cài đặt** ➔ **Xem tất cả chế độ cài đặt**.
   - Chuyển sang tab **Chuyển tiếp và POP/IMAP** (Forwarding and POP/IMAP).
   - Ở mục **Truy cập qua IMAP**: Chọn **Bật IMAP** (Enable IMAP) ➔ Bấm **Lưu thay đổi**.
4. **Kiểm tra kết nối mạng trước khi demo:**
   - Kiểm tra cổng IMAP 993: Mở PowerShell gõ `Test-NetConnection imap.gmail.com -Port 993`. Nếu `TcpTestSucceeded: True` là mạng đã thông suốt.

---

## CÂU HỎI VÀ ĐÁP ÁN BẢO VỆ PHẢN BIỆN (Q&A CHO GIẢNG VIÊN)

### Q1: "Đề bài là Gmail SMTP, tại sao nhóm lại dùng thêm cả IMAP?"
> **Đáp án:**
> "SMTP vốn dĩ là giao thức một chiều (chỉ phục vụ chiều gửi đi - Outbound). Trong các hệ thống SOA thực tế, nếu chỉ dùng SMTP thì người dùng luôn phải click vào một đường link web để tương tác tiếp, làm gián đoạn trải nghiệm người dùng.  
> Để hoàn thiện chu trình nghiệp vụ khép kín **ngay trên hòm thư** theo chuẩn **Bidirectional Email Messaging**, nhóm tích hợp thêm **IMAP IDLE (Cổng 993)** đóng vai trò Event Consumer ở tầng Gateway. Nhờ đó, Quản lý chỉ cần bấm **Reply** và gõ 'Duyệt' là hệ thống tự động bắt tín hiệu và hoàn tất nghiệp vụ. Đây là bước phát triển tự nhiên từ SMTP sang giải pháp tương tác hoàn chỉnh trong SOA."

### Q2: "Làm sao hệ thống chắc chắn người Reply đúng là Quản lý mà không phải người khác giả mạo?"
> **Đáp án:**
> "Hệ thống áp dụng cơ chế bảo mật 3 lớp nghiêm ngặt:
> 1. **Tầng mạng & Email Server:** Google Gmail tự động áp dụng các chuẩn SPF, DKIM và DMARC, đảm bảo địa chỉ người gửi không thể bị giả mạo ở tầng giao thức.
> 2. **Tầng ứng dụng nghiệp vụ:** Leave App trích xuất địa chỉ email thuần của người gửi (loại bỏ tên hiển thị giả mạo) và so khớp chính xác (`===`) với trường `leave.managerEmail` được phân công cụ thể của đơn đó.
> 3. **Tầng luồng hội thoại:** Hệ thống xác thực chuỗi `In-Reply-To` khớp với Message-ID của thư gốc và mã định danh duy nhất `#lv_[a-f0-9]{12}` trong tiêu đề đơn."

### Q3: "Tại sao không để Gateway tự phân tích chữ 'Duyệt' và tự cập nhật cơ sở dữ liệu?"
> **Đáp án:**
> "Đây là điểm cốt lõi của nguyên lý **Loose Coupling (Ràng buộc lỏng lẻo)** trong kiến trúc SOA. Gateway là dịch vụ hạ tầng dùng chung (Email-as-a-Service), không được phép chứa logic nghiệp vụ đặc thù của ứng dụng Quản lý Nghỉ phép.  
> Trách nhiệm của Gateway dừng lại ở việc: đọc email qua IMAP, cắt bỏ khối trích dẫn thư cũ (`cleanReplyText`), và phát sự kiện chuẩn `email.reply.received` qua Webhook có chữ ký bí mật `X-Webhook-Secret`. Toàn bộ quyết định ai được duyệt, từ khóa nào hợp lệ, và cập nhật trạng thái đơn thuộc về ứng dụng nghiệp vụ Leave App."

---

## CẤU TRÚC THƯ MỤC DỰ ÁN

```
d:\STUDY\SOA\Seminar\GmailSMTP/
├── demo-app/                            # Ứng dụng nghiệp vụ Quản lý nghỉ phép (Cổng 4000)
│   ├── public/                          # Giao diện Portal nhân viên & trang xác nhận dự phòng
│   ├── mailer.js                        # Client gọi Email Service Gateway qua chuẩn REST API
│   ├── server.js                        # Máy chủ nghiệp vụ & Webhook Consumer (nhận sự kiện Reply)
│   └── store.js                         # Quản lý người dùng, OTP 5m, đơn nghỉ phép & quyết định
├── src/                                 # Email Gateway Service (Cổng 3000)
│   ├── api/                             # Controllers xử lý REST API & Webhook
│   │   ├── config.controller.js         # API cấu hình chế độ Sandbox/Live & đồng bộ IMAP
│   │   └── mail.controller.js           # API gửi mail, xác thực OTP, reset pass, sandbox reply
│   ├── core/                            # Tầng xử lý cốt lõi của Email Service
│   │   ├── circuit-breaker.js           # Bộ ngắt mạch bảo vệ tài khoản Gmail chống spam
│   │   ├── imap-listener.js             # Dịch vụ IMAP IDLE lắng nghe thư trả lời thời gian thực
│   │   ├── imap-service.js              # Quản lý vòng đời kết nối IMAP & WebSocket broadcast
│   │   ├── mode-manager.js              # Quản lý trạng thái chuyển đổi Sandbox / Live Gmail
│   │   ├── queue.js                     # Hàng đợi phi khóa (Non-blocking), Retry & DLQ
│   │   ├── sandbox-store.js             # Hộp thư ảo lưu trữ email trên RAM ở Sandbox
│   │   ├── security.js                  # Bảo mật API Key (timing-safe) & bảo vệ API quản trị
│   │   ├── smtp-live.js                 # Pool kết nối SMTP gửi thư thật qua Gmail (cổng 587)
│   │   ├── templates.js                 # Template Engine render HTML Responsive (OTP, Reset 5m, Action)
│   │   ├── text-cleaner.js              # Bộ làm sạch trích dẫn thư cũ trong phản hồi Email
│   │   ├── validator.js                 # Kiểm tra tính hợp lệ của email và dữ liệu đầu vào
│   │   └── webhook-dispatcher.js        # Bắn Webhook kèm X-Webhook-Secret khi có thư đến
│   ├── public/                          # Giao diện Web Dashboard quản trị
│   │   ├── index.html                   # Giao diện Dashboard theo dõi hàng đợi & hộp thư ảo
│   │   ├── style.css                    # CSS giao diện Dark Mode / Modern Clean
│   │   └── app.js                       # Logic Dashboard, WebSocket & nút Trả lời thư Sandbox
│   ├── config.js                        # Cấu hình tập trung (TTL 5 phút, API Key, Sender Name)
│   └── server.js                        # Điểm khởi chạy hệ thống (Express + WebSocket + Shutdown)
├── test/                                # Bộ kịch bản automation test
│   ├── demo-e2e.test.js                 # Test toàn luồng nghiệp vụ tự động (Two-Way E2E)
│   ├── queue-benchmark.test.js          # Benchmark 5 bài test cốt lõi (SLA, DLQ, Circuit Breaker)
│   └── stress-test.js                   # Stress test 100 requests đồng thời đo độ trễ
├── .env.example                         # Mẫu khai báo biến môi trường (GMAIL, TTL, API_KEY, WEBHOOK)
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
| **Không nhận được phản hồi qua IMAP** | Chưa bật IMAP trong cài đặt Gmail hoặc bị chặn cổng `993` | Vào Gmail > Cài đặt > Chuyển tiếp và POP/IMAP > Bật IMAP; hoặc kiểm tra bằng lệnh `Test-NetConnection imap.gmail.com -Port 993`. |
| **Circuit Breaker báo `OPEN`** | Gặp 5 lỗi liên tiếp (thường do sai mật khẩu) | Vào Tab Cấu hình kiểm tra lại App Password, sau đó Circuit Breaker sẽ tự phục hồi sau 30 giây. |

> **Học phần:** Kiến Trúc Hướng Dịch Vụ (SOA) – Khoa CNTT, Đại Học Tôn Đức Thắng (TDTU)
