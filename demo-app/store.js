/**
 * demo-app/store.js
 * Demo Ứng Dụng Xin Nghỉ Phép TMT COMPANY(End-to-End)
 * Quản lý người dùng, OTP xác thực, đơn nghỉ phép, token quyết định và phiên làm việc
 */

const crypto = require('crypto');

// Băm mật khẩu bằng crypto.scrypt an toàn
function hashPassword(password, salt = null) {
  const generatedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, generatedSalt, 64).toString('hex');
  return { hash, salt: generatedSalt };
}

function verifyPassword(password, hash, salt) {
  const result = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(result, 'hex'));
}

class DemoStore {
  constructor() {
    this.users = new Map();         // email -> { id, email, name, passwordHash, salt, isVerified, role }
    this.otps = new Map();          // email -> { otp, expiresAt, attempts }
    this.leaves = new Map();        // leaveId -> { id, employeeEmail, employeeName, startDate, endDate, days, reason, status, decisionToken, createdAt, decidedAt }
    this.tokens = new Map();        // tokenString -> { type, data, expiresAt, used }
    this.sessions = new Map();      // sessionId -> { email, name, role, createdAt }

    // Khởi tạo tài khoản quản lý mẫu
    const managerEmail = (process.env.MANAGER_EMAIL || 'manager@demo.local').toLowerCase().trim();
    const { hash, salt } = hashPassword('Manager@123');
    this.users.set(managerEmail, {
      id: 'usr_mgr_001',
      email: managerEmail,
      name: 'Quản Lý Trưởng Bộ Phận',
      passwordHash: hash,
      salt,
      isVerified: true,
      role: 'MANAGER',
      createdAt: new Date().toISOString()
    });
  }

  // USER MANAGEMENT
  createUser({ email, name, password }) {
    const normalizedEmail = email.toLowerCase().trim();
    if (this.users.has(normalizedEmail)) {
      const existing = this.users.get(normalizedEmail);
      if (existing.isVerified) {
        throw new Error('Email này đã được đăng ký và xác thực.');
      }
      // Nếu chưa xác thực thì cho phép cập nhật lại thông tin
    }

    const { hash, salt } = hashPassword(password);
    const user = {
      id: 'usr_' + crypto.randomBytes(6).toString('hex'),
      email: normalizedEmail,
      name: name.trim(),
      passwordHash: hash,
      salt,
      isVerified: false,
      role: 'EMPLOYEE',
      createdAt: new Date().toISOString()
    };
    this.users.set(normalizedEmail, user);
    return user;
  }

  getUser(email) {
    if (!email) return null;
    return this.users.get(email.toLowerCase().trim()) || null;
  }

  // OTP VERIFICATION (5 phút, tối đa 5 lần thử sai)
  createOtp(email) {
    const normalizedEmail = email.toLowerCase().trim();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 phút

    this.otps.set(normalizedEmail, {
      otp,
      expiresAt,
      attempts: 0
    });
    return otp;
  }

  verifyOtp(email, inputOtp) {
    const normalizedEmail = email.toLowerCase().trim();
    const record = this.otps.get(normalizedEmail);

    if (!record) {
      return { success: false, error: 'Chưa có mã OTP nào được gửi cho email này.' };
    }

    if (Date.now() > record.expiresAt) {
      this.otps.delete(normalizedEmail);
      return { success: false, error: 'Mã OTP đã hết hạn (quá 5 phút). Vui lòng yêu cầu mã mới.' };
    }

    if (record.attempts >= 5) {
      this.otps.delete(normalizedEmail);
      return { success: false, error: 'Bạn đã nhập sai OTP quá 5 lần. Mã đã bị hủy để đảm bảo an toàn.' };
    }

    if (record.otp !== String(inputOtp).trim()) {
      record.attempts += 1;
      return {
        success: false,
        error: `Mã OTP không chính xác. Còn lại ${5 - record.attempts} lần thử.`
      };
    }

    // Xác thực thành công
    this.otps.delete(normalizedEmail);
    const user = this.users.get(normalizedEmail);
    if (user) {
      user.isVerified = true;
    }
    return { success: true, user };
  }

  // SESSIONS
  createSession(user) {
    const sessionId = 'ses_' + crypto.randomBytes(24).toString('hex');
    this.sessions.set(sessionId, {
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: Date.now()
    });
    return sessionId;
  }

  getSession(sessionId) {
    if (!sessionId) return null;
    return this.sessions.get(sessionId) || null;
  }

  // LEAVE MANAGEMENT
  createLeave({ employeeEmail, employeeName, startDate, endDate, days, reason }) {
    const leaveId = 'lv_' + crypto.randomBytes(6).toString('hex');
    const decisionToken = crypto.randomBytes(24).toString('hex');

    const leave = {
      id: leaveId,
      employeeEmail: employeeEmail.toLowerCase().trim(),
      employeeName,
      startDate,
      endDate,
      days: Number(days) || 1,
      reason: reason.trim(),
      status: 'PENDING', // PENDING | APPROVED | REJECTED
      decisionToken,
      createdAt: new Date().toISOString(),
      decidedAt: null
    };

    this.leaves.set(leaveId, leave);

    // Lưu token quyết định (Hiệu lực 24 giờ, dùng 1 lần)
    this.tokens.set(decisionToken, {
      type: 'LEAVE_DECISION',
      data: { leaveId },
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      used: false
    });

    return leave;
  }

  getLeave(leaveId) {
    return this.leaves.get(leaveId) || null;
  }

  getLeavesByEmployee(email) {
    const normalized = email.toLowerCase().trim();
    return Array.from(this.leaves.values())
      .filter(l => l.employeeEmail === normalized)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  // DECISION TOKEN VERIFICATION
  getDecisionByToken(token) {
    const record = this.tokens.get(token);
    if (!record || record.type !== 'LEAVE_DECISION') {
      return { valid: false, error: 'Liên kết xác nhận không hợp lệ hoặc không tồn tại.' };
    }
    if (record.used) {
      const leave = this.leaves.get(record.data.leaveId);
      return {
        valid: false,
        error: `Đơn nghỉ phép này của bạn đã được xử lý trước đó với kết quả: ${leave ? leave.status : 'ĐÃ HOÀN TẤT'}. Không thể thao tác lại.`
      };
    }
    if (Date.now() > record.expiresAt) {
      return { valid: false, error: 'Liên kết xác nhận đã hết hạn (quá 24 giờ).' };
    }

    const leave = this.leaves.get(record.data.leaveId);
    if (!leave) {
      return { valid: false, error: 'Không tìm thấy thông tin đơn nghỉ phép.' };
    }

    return { valid: true, leave, tokenRecord: record };
  }

  processDecision(token, action) {
    const check = this.getDecisionByToken(token);
    if (!check.valid) {
      return check;
    }

    const normalizedAction = action.toUpperCase();
    if (!['APPROVE', 'REJECT'].includes(normalizedAction)) {
      return { valid: false, error: 'Hành động không hợp lệ. Chỉ chấp nhận approve hoặc reject.' };
    }

    const leave = check.leave;
    leave.status = normalizedAction === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    leave.decidedAt = new Date().toISOString();

    // Đánh dấu token đã sử dụng (dùng 1 lần)
    check.tokenRecord.used = true;

    return { valid: true, leave, status: leave.status };
  }

  // PASSWORD RESET TOKEN (5 phút TTL)
  createResetToken(email) {
    const normalized = email.toLowerCase().trim();
    const user = this.users.get(normalized);
    if (!user) {
      return null;
    }

    const resetToken = crypto.randomBytes(24).toString('hex');
    this.tokens.set(resetToken, {
      type: 'PASSWORD_RESET',
      data: { email: normalized },
      expiresAt: Date.now() + 5 * 60 * 1000, // Đúng 5 phút theo quy định
      used: false
    });

    return { resetToken, user };
  }

  verifyResetToken(token) {
    const record = this.tokens.get(token);
    if (!record || record.type !== 'PASSWORD_RESET') {
      return { valid: false, error: 'Mã đặt lại mật khẩu không hợp lệ.' };
    }
    if (record.used) {
      return { valid: false, error: 'Liên kết đặt lại mật khẩu này đã được sử dụng.' };
    }
    if (Date.now() > record.expiresAt) {
      return { valid: false, error: 'Liên kết đặt lại mật khẩu đã hết hạn (quá 5 phút).' };
    }
    return { valid: true, email: record.data.email, tokenRecord: record };
  }

  resetPassword(token, newPassword) {
    const check = this.verifyResetToken(token);
    if (!check.valid) {
      return check;
    }

    const user = this.users.get(check.email);
    if (!user) {
      return { valid: false, error: 'Không tìm thấy tài khoản người dùng.' };
    }

    const { hash, salt } = hashPassword(newPassword);
    user.passwordHash = hash;
    user.salt = salt;
    check.tokenRecord.used = true;

    return { valid: true, message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.' };
  }
}

module.exports = new DemoStore();
