# BÁO CÁO ĐÁNH GIÁ TIẾN ĐỘ & KẾ HOẠCH NƯỚC RÚT SEMINAR
**Đề tài:** Email Service Integration (Gmail SMTP) – Account verification, Password reset, HTML email  
**Học phần:** Kiến trúc hướng dịch vụ (SOA) – Khoa CNTT, ĐH Tôn Đức Thắng

---

## 1. ĐỐI CHIẾU VỚI YÊU CẦU ĐỀ BÀI CHÍNH THỨC

| Yêu cầu đề bài | Tình trạng trước đây | Tình trạng sau nâng cấp | Đánh giá |
| :--- | :--- | :--- | :---: |
| **1. Account Verification** | Chưa có endpoint, không sinh OTP/Token | Đã có `POST /api/v1/verify-email`, tự sinh OTP 6 số hoặc link kích hoạt, render template responsive | ✅ **Hoàn thành 100%** |
| **2. Password Reset** | Chưa có endpoint, không có link reset, không có TTL | Đã có `POST /api/v1/password-reset`, hỗ trợ link reset token + thời hạn 5 phút an toàn (chuẩn đề bài) | ✅ **Hoàn thành 100%** |
| **3. HTML Email** | Nhận HTML thô qua `/send`, không có template | Đã có `templates.js` với 3 mẫu chuẩn: `verify-email`, `password-reset`, `custom-html` | ✅ **Hoàn thành 100%** |

---

## 2. PHÂN ĐỊNH PHẠM VI (SCOPE MANAGEMENT)

Để bài thuyết trình không bị lan man và bám sát tiêu chí chấm điểm của Giảng viên:

* **PHẠM VI TRỌNG TÂM (TẬP TRUNG THUYẾT TRÌNH & DEMO CHÍNH):**
  1. Kiến trúc SOA: Tách rời Email thành một Microservice độc lập.
  2. Gửi thư qua Gmail SMTP (cổng 587 STARTTLS) dùng **App Password**.
  3. Xử lý 3 use case cốt lõi: **Xác thực tài khoản (OTP)**, **Đặt lại mật khẩu (Token)**, **Thư HTML đồ họa cao cấp**.
  4. Hàng đợi phi khóa (Non-blocking Queue) phản hồi tức thì `202 Accepted` (< 45ms).
  5. Độ tin cậy: **Exponential Backoff Retry**, **Dead-Letter Queue (DLQ)** và **Circuit Breaker**.
  6. Tính tái sử dụng: Sinh viên khác tải về, chạy `start.bat` trong **≤ 5 phút** là dùng được ngay.

* **PHẠM VI MỞ RỘNG (CHUYỂN VÀO MỤC "TÍNH NĂNG MỞ RỘNG", KHÔNG DEMO CHÍNH):**
  - IMAP IDLE Listener (nhận mail cổng 993) & Webhook Dispatcher.
  - Web Component nhúng 1 dòng `<mail-widget>`.

---

## 3. PHÂN BỔ NHIỆM VỤ NƯỚC RÚT CHO TỪNG THÀNH VIÊN

| # | Hạng mục công việc | Người phụ trách | Hạn hoàn thành | Trạng thái |
| :-: | :--- | :---: | :---: | :---: |
| 1 | Xây dựng module `templates.js` (Verify, Reset, Custom HTML) | **Thành** | Ngày 1 | ✅ Đã xong |
| 2 | Endpoint `POST /api/v1/verify-email` (tự sinh OTP ở Sandbox; nhận OTP/link ở Live) | **Thành** | Ngày 1 | ✅ Đã xong |
| 3 | Endpoint `POST /api/v1/password-reset` (link + TTL 5 phút chuẩn hóa qua config) | **Thành** | Ngày 1 | ✅ Đã xong |
| 4 | Cập nhật `/api/v1/send` nhận template và biến động | **Thành** | Ngày 1 | ✅ Đã xong |
| 5 | Nâng cấp Dashboard: 3 nút preset demo Verify, Reset, HTML | **Đạt** | Ngày 2 | ✅ Đã xong |
| 6 | Nâng cấp trang `demo/index.html` thành App Auth mô phỏng Đăng ký & Quên mật khẩu | **Đạt** | Ngày 2 | ✅ Đã xong |
| 7 | Cập nhật Postman Collection cho 3 use case chính | **Đức** | Ngày 2 | ✅ Đã xong |
| 8 | Viết lại tài liệu `README.md` theo cấu trúc 3 bước dễ hiểu, hướng dẫn lấy App Password (2FA) | **Đức** | Ngày 3 | ⏳ Đang tiến hành |
| 9 | Thiết kế bộ Slide thuyết trình (< 30 phút) bám sát 7 tiêu chí Rubric | **Đạt** | Ngày 3 - 4 | ⏳ Đang tiến hành |
| 10 | Tập dượt thuyết trình, quay video demo dự phòng (≥ 20 phút) | **Cả nhóm** | Ngày 5 | ⏳ Đang tiến hành |

---

## 4. BẢNG TỔNG KẾT MỨC ĐỘ SẴN SÀNG

* **Hạ tầng lõi (Gateway, SMTP, Queue, Circuit Breaker, Sandbox):** **100%**
* **3 Chức năng cốt lõi theo đề bài:** **100%**
* **Giao diện & Trang Demo trực quan:** **100%**
* **Tài liệu cho sinh viên khác (README, Postman, Guide):** **85%**
* **Slide & Kịch bản thuyết trình:** **Đã có khung chi tiết trong Proposal**
