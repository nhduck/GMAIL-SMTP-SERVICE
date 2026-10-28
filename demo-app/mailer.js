/**
 * demo-app/mailer.js
 * Client Module gọi Email Service Gateway (PORT 3000) từ phía Server
 * Đảm bảo tính lỏng lẻo (Loose Coupling) và gọi qua chuẩn REST API
 */

const SERVICE_URL = process.env.SERVICE_URL || 'http://localhost:3000';

function buildHeaders(extra = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...extra
  };
  const apiKey = process.env.SERVICE_API_KEY || process.env.API_KEY;
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }
  return headers;
}

async function requestEmailService(endpoint, payload) {
  const url = `${SERVICE_URL}${endpoint}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error(`[Mailer Client] Gọi ${endpoint} thất bại (${res.status}):`, data.error || res.statusText);
      return { success: false, status: res.status, error: data.error || 'Lỗi gửi yêu cầu tới Email Service' };
    }

    return { success: true, status: res.status, data };
  } catch (err) {
    console.error(`[Mailer Client] Lỗi kết nối tới Email Service (${url}):`, err.message);
    return { success: false, error: `Không thể kết nối tới Email Gateway tại ${SERVICE_URL}: ${err.message}` };
  }
}

async function getGatewayConfig() {
  try {
    const res = await fetch(`${SERVICE_URL}/api/v1/config`, {
      headers: buildHeaders()
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || null;
  } catch (_) {
    return null;
  }
}

module.exports = {
  getGatewayConfig,

  // Gửi mã OTP xác thực tài khoản (hiệu lực 5 phút đồng bộ với store.js)
  async sendVerificationEmail({ to, name, otp }) {
    return await requestEmailService('/api/v1/verify-email', {
      to,
      name,
      otp,
      expiresInMinutes: 5,
      appName: 'TMT Company'
    });
  },

  // Gửi email hành động cho Quản lý phê duyệt
  async sendLeaveRequestToManager({ managerEmail, leave, approveUrl, rejectUrl }) {
    const subject = 'Đơn Xin Nghỉ Phép Cần Phê Duyệt';
    return await requestEmailService('/api/v1/send', {
      to: managerEmail,
      subject,
      template: 'action-email',
      variables: {
        appName: 'TMT Company',
        title: subject,
        greeting: 'Chào Quản lý,',
        intro: `Nhân viên ${leave.employeeName} (${leave.employeeEmail}) vừa gửi một đơn xin nghỉ phép mới trên hệ thống:`,
        badge: { text: 'CHỜ PHÊ DUYỆT', tone: 'warning' },
        details: [
          { label: 'Nhân viên yêu cầu', value: `${leave.employeeName} (${leave.employeeEmail})` },
          { label: 'Thời gian nghỉ', value: `Từ ${leave.startDate} đến ${leave.endDate} (${leave.days} ngày)` },
          { label: 'Lý do xin nghỉ', value: leave.reason },
          { label: 'Thời điểm tạo', value: new Date(leave.createdAt).toLocaleString('vi-VN') }
        ],
        primaryButton: { text: 'Duyệt Đơn', url: approveUrl },
        secondaryButton: { text: 'Từ Chối', url: rejectUrl },
        footer: 'Liên kết trên chỉ mở trang xác nhận quyết định an toàn (CSRF-Safe) và có hiệu lực dùng 1 lần trong 24 giờ.'
      }
    });
  },

  // Gửi thông báo kết quả phê duyệt về cho Nhân viên
  async sendLeaveResultToEmployee({ employeeEmail, leave, action }) {
    const isApproved = action === 'APPROVE';
    const subject = isApproved ? 'Đơn Xin Nghỉ Phép Đã Được Duyệt' : 'Đơn Xin Nghỉ Phép Đã Bị Từ Chối';
    return await requestEmailService('/api/v1/send', {
      to: employeeEmail,
      subject,
      template: 'action-email',
      variables: {
        appName: 'TMT Company',
        title: subject,
        greeting: `Chào ${leave.employeeName},`,
        intro: isApproved
          ? 'Đơn xin nghỉ phép của bạn đã được quản lý bộ phận phê duyệt thành công.'
          : 'Đơn xin nghỉ phép của bạn đã bị từ chối. Vui lòng liên hệ quản lý trực tiếp nếu cần thêm thông tin.',
        badge: isApproved
          ? { text: 'ĐÃ PHÊ DUYỆT', tone: 'success' }
          : { text: 'BỊ TỪ CHỐI', tone: 'danger' },
        details: [
          { label: 'Mã đơn nghỉ phép', value: leave.id },
          { label: 'Thời gian nghỉ', value: `Từ ${leave.startDate} đến ${leave.endDate} (${leave.days} ngày)` },
          { label: 'Lý do ban đầu', value: leave.reason },
          { label: 'Thời điểm xử lý', value: new Date(leave.decidedAt || Date.now()).toLocaleString('vi-VN') }
        ],
        footer: 'Email kết quả tự động từ Cổng Thông Tin Nhân Sự TMT Company.'
      }
    });
  },

  // Gửi email đặt lại mật khẩu với link TTL 5 phút
  async sendPasswordResetEmail({ to, name, resetUrl }) {
    return await requestEmailService('/api/v1/password-reset', {
      to,
      name,
      resetUrl,
      expiresInMinutes: 5,
      appName: 'TMT Company'
    });
  }
};
