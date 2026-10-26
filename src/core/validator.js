// Email & Payload Validator (Chuẩn RFC 5322 & Business Rules)
// Regex kiểm tra địa chỉ email theo chuẩn RFC 5322
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

module.exports = {
  isValidEmail: (email) => {
    if (!email || typeof email !== 'string') return false;
    const trimmed = email.trim();
    if (trimmed.length > 254) return false;
    return EMAIL_REGEX.test(trimmed);
  },

  validateSendPayload: (payload) => {
    const errors = [];

    if (!payload || typeof payload !== 'object') {
      return { isValid: false, errors: ['Dữ liệu gửi lên phải là một đối tượng JSON hợp lệ.'] };
    }

    const { to, subject, text, html } = payload;

    // 1. Kiểm tra trường "to"
    if (!to) {
      errors.push('Trường "to" (địa chỉ email người nhận) là bắt buộc.');
    } else {
      // Hỗ trợ cả 1 email chuỗi hoặc mảng nhiều email
      const recipients = Array.isArray(to) ? to : [to];
      recipients.forEach((email, idx) => {
        if (!module.exports.isValidEmail(email)) {
          errors.push(`Email người nhận thứ ${idx + 1} ("${email}") không đúng định dạng chuẩn.`);
        }
      });
    }

    // 2. Kiểm tra trường "subject"
    if (subject !== undefined && typeof subject !== 'string') {
      errors.push('Trường "subject" phải là chuỗi ký tự.');
    } else if (subject && subject.length > 300) {
      errors.push('Tiêu đề email "subject" không được vượt quá 300 ký tự.');
    }

    // 3. Kiểm tra nội dung (phải có ít nhất text, html, hoặc template)
    const hasText = text && typeof text === 'string' && text.trim().length > 0;
    const hasHtml = html && typeof html === 'string' && html.trim().length > 0;
    const hasTemplate = payload.template && typeof payload.template === 'string' && payload.template.trim().length > 0;

    if (!hasText && !hasHtml && !hasTemplate) {
      errors.push('Email phải có ít nhất một trong các trường: "template", "html", hoặc "text".');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
};
