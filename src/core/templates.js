// Template Engine cho Email

const config = require('../config');

// Bộ mẫu HTML Email Responsive
const TEMPLATES = {
  // Mẫu Xác Thực Tài Khoản
  'verify-email': {
    defaultSubject: 'Xác thực tài khoản của bạn',
    render: (vars = {}) => {
      const name = vars.name || 'Khách hàng';
      const otp = vars.otp || '';
      const verifyUrl = vars.verifyUrl || '';
      const appName = vars.appName || 'Hệ thống SOA Service';

      const actionSection = verifyUrl
        ? `
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" target="_blank" style="background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);">
              Kích Hoạt Tài Khoản Ngay
            </a>
          </div>
          <p style="color: #64748b; font-size: 13px; text-align: center;">Hoặc copy đường dẫn sau: <a href="${verifyUrl}" style="color: #2563eb; word-break: break-all;">${verifyUrl}</a></p>
        `
        : `
          <div style="background: #f1f5f9; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 20px; text-align: center; margin: 25px 0;">
            <p style="margin: 0 0 8px 0; color: #475569; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Mã xác thực OTP của bạn</p>
            <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1e293b; font-family: monospace;">${otp}</div>
            <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 12px;">Mã có hiệu lực trong vòng 10 phút. Tuyệt đối không chia sẻ mã này.</p>
          </div>
        `;

      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Xác thực tài khoản</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 10px;">
            <tr>
              <td align="center">
                <table width="100%" max-width="560" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #2563eb, #1e40af); padding: 32px 24px; text-align: center;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">${appName}</h1>
                      <p style="margin: 6px 0 0 0; color: #bfdbfe; font-size: 14px;">Xác thực tài khoản người dùng</p>
                    </td>
                  </tr>
                  <!-- Body -->
                  <tr>
                    <td style="padding: 36px 32px; color: #334155; line-height: 1.6;">
                      <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 20px;">Xin chào ${name},</h2>
                      <p style="margin: 0 0 16px 0; font-size: 15px;">Cảm ơn bạn đã đăng ký tài khoản tại <strong>${appName}</strong>. Để hoàn tất quá trình thiết lập và bảo vệ tài khoản, vui lòng xác thực địa chỉ email của bạn.</p>
                      ${actionSection}
                      <p style="margin: 24px 0 0 0; font-size: 14px; color: #64748b;">Nếu bạn không thực hiện đăng ký tài khoản này, vui lòng bỏ qua email hoặc liên hệ với bộ phận hỗ trợ.</p>
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px;">
                      <p style="margin: 0 0 4px 0;">Email này được gửi tự động từ <strong>${appName}</strong> qua Gmail SMTP Gateway.</p>
                      <p style="margin: 0;">© ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;
    }
  },

  // 2. Mẫu Đặt Lại Mật Khẩu (Password Reset)
  'password-reset': {
    defaultSubject: 'Yêu cầu đặt lại mật khẩu tài khoản',
    render: (vars = {}) => {
      const name = vars.name || 'Quý khách';
      const resetUrl = vars.resetUrl || '#';
      const expiresIn = vars.expiresInMinutes || config.RESET_TTL_MINUTES;
      const appName = vars.appName || 'Hệ thống SOA Service';

      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Đặt lại mật khẩu</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 10px;">
            <tr>
              <td align="center">
                <table width="100%" max-width="560" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                  <!-- Header Warning Style -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #dc2626, #b91c1c); padding: 32px 24px; text-align: center;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">${appName}</h1>
                      <p style="margin: 6px 0 0 0; color: #fecaca; font-size: 14px;">Yêu cầu thay đổi mật khẩu an toàn</p>
                    </td>
                  </tr>
                  <!-- Body -->
                  <tr>
                    <td style="padding: 36px 32px; color: #334155; line-height: 1.6;">
                      <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 20px;">Xin chào ${name},</h2>
                      <p style="margin: 0 0 16px 0; font-size: 15px;">Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Nhấn vào nút bên dưới để tạo mật khẩu mới:</p>
                      
                      <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetUrl}" target="_blank" style="background: linear-gradient(135deg, #dc2626, #b91c1c); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);">
                          Đặt Lại Mật Khẩu
                        </a>
                      </div>

                      <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 14px 16px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
                        <p style="margin: 0; color: #991b1b; font-size: 13px; font-weight: 500;">
                          ⚠️ <strong>Lưu ý bảo mật:</strong> Liên kết này chỉ có hiệu lực trong vòng <strong>${expiresIn} phút</strong>. Nếu quá thời gian, bạn cần thực hiện lại yêu cầu.
                        </p>
                      </div>

                      <p style="color: #64748b; font-size: 13px; text-align: center;">Hoặc dán liên kết vào trình duyệt: <br/><a href="${resetUrl}" style="color: #dc2626; word-break: break-all;">${resetUrl}</a></p>
                      <p style="margin: 20px 0 0 0; font-size: 14px; color: #64748b;">Nếu bạn KHÔNG yêu cầu đổi mật khẩu, có thể tài khoản của bạn đang có người cố gắng truy cập. Hãy bỏ qua email này hoặc đổi mật khẩu ngay.</p>
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px;">
                      <p style="margin: 0 0 4px 0;">Email bảo mật gửi từ <strong>${appName}</strong> qua Gmail SMTP Relay.</p>
                      <p style="margin: 0;">© ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;
    }
  },

  // 3. Mẫu HTML Tùy Biến (Custom HTML Email)
  'custom-html': {
    defaultSubject: 'Thông báo từ hệ thống',
    render: (vars = {}) => {
      const title = vars.title || 'Thông Báo Mới';
      const content = vars.content || '<p>Nội dung thông báo từ hệ thống.</p>';
      const appName = vars.appName || 'Hệ thống SOA Service';

      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 10px;">
            <tr>
              <td align="center">
                <table width="100%" max-width="560" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                  <tr>
                    <td style="background: linear-gradient(135deg, #0f172a, #1e293b); padding: 28px 24px; text-align: center;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 22px;">${appName}</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 32px; color: #334155; line-height: 1.6;">
                      <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 20px;">${title}</h2>
                      <div style="font-size: 15px;">${content}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="background-color: #f8fafc; padding: 18px 32px; text-align: center; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px;">
                      © ${new Date().getFullYear()} ${appName}.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;
    }
  },

  // 4. Mẫu Email Hành Động Tổng Quát (Action Email - Bảng chi tiết, nhãn trạng thái, nút Duyệt / Từ chối)
  'action-email': {
    defaultSubject: 'Thông báo cần xử lý',
    render: (vars = {}) => {
      const appName = escapeHtml(vars.appName || 'Hệ thống Dịch Vụ SOA');
      const title = escapeHtml(vars.title || 'Thông Báo Mới');
      const greeting = escapeHtml(vars.greeting || 'Xin chào,');
      const intro = escapeHtml(vars.intro || '');
      const footer = escapeHtml(vars.footer || '');

      // Render Badge nhãn trạng thái nếu có
      let badgeHtml = '';
      if (vars.badge && vars.badge.text) {
        const tone = vars.badge.tone || 'info';
        const toneStyles = {
          success: 'background-color: #dcfce7; color: #15803d; border: 1px solid #bbf7d0;',
          danger: 'background-color: #fee2e2; color: #b91c1c; border: 1px solid #fecaca;',
          warning: 'background-color: #fef3c7; color: #b45309; border: 1px solid #fde68a;',
          info: 'background-color: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd;'
        };
        const selectedStyle = toneStyles[tone] || toneStyles.info;
        badgeHtml = `
          <div style="margin-bottom: 16px;">
            <span style="display: inline-block; padding: 6px 14px; font-size: 13px; font-weight: 700; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px; ${selectedStyle}">
              ${escapeHtml(vars.badge.text)}
            </span>
          </div>
        `;
      }

      // Render Bảng Details danh sách { label, value } nếu có
      let detailsHtml = '';
      if (Array.isArray(vars.details) && vars.details.length > 0) {
        const rows = vars.details.map((item, idx) => {
          const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
          return `
            <tr style="background-color: ${bg};">
              <td style="padding: 10px 14px; font-weight: 600; color: #475569; font-size: 13px; width: 35%; border-bottom: 1px solid #e2e8f0;">
                ${escapeHtml(item.label)}
              </td>
              <td style="padding: 10px 14px; color: #0f172a; font-size: 14px; border-bottom: 1px solid #e2e8f0;">
                ${escapeHtml(item.value)}
              </td>
            </tr>
          `;
        }).join('');

        detailsHtml = `
          <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0; border: 1px solid #e2e8f0; border-radius: 8px; border-collapse: collapse; overflow: hidden;">
            ${rows}
          </table>
        `;
      }

      // Render Action Buttons nếu có
      let buttonsHtml = '';
      const primaryUrl = sanitizeUrl(vars.primaryButton && vars.primaryButton.url);
      const secondaryUrl = sanitizeUrl(vars.secondaryButton && vars.secondaryButton.url);

      if (primaryUrl || secondaryUrl) {
        let pBtn = '';
        let sBtn = '';

        if (primaryUrl) {
          const pText = escapeHtml((vars.primaryButton && vars.primaryButton.text) || 'Xác nhận');
          pBtn = `
            <a href="${primaryUrl}" target="_blank" style="display: inline-block; min-width: 130px; text-align: center; background: linear-gradient(135deg, #16a34a, #15803d); color: #ffffff; text-decoration: none; padding: 13px 24px; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 6px; box-shadow: 0 4px 10px rgba(22, 163, 74, 0.25);">
              ✓ ${pText}
            </a>
          `;
        }

        if (secondaryUrl) {
          const sText = escapeHtml((vars.secondaryButton && vars.secondaryButton.text) || 'Từ chối');
          sBtn = `
            <a href="${secondaryUrl}" target="_blank" style="display: inline-block; min-width: 130px; text-align: center; background: linear-gradient(135deg, #ef4444, #dc2626); color: #ffffff; text-decoration: none; padding: 13px 24px; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 6px; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.25);">
              ✕ ${sText}
            </a>
          `;
        }

        buttonsHtml = `
          <div style="text-align: center; margin: 28px 0 16px 0;">
            ${pBtn}
            ${sBtn}
          </div>
          <p style="text-align: center; color: #64748b; font-size: 12px; margin-top: 4px;">
            Nhấn vào nút trên để mở trang xác nhận quyết định an toàn.
          </p>
        `;
      }

      const footerSection = footer
        ? `<p style="margin: 20px 0 0 0; font-size: 13px; color: #64748b;">${footer}</p>`
        : '';

      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 30px 10px;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #1e293b, #0f172a); padding: 26px 28px; text-align: left;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.3px;">${appName}</h1>
                    </td>
                  </tr>
                  <!-- Body -->
                  <tr>
                    <td style="padding: 32px 28px; color: #334155; line-height: 1.6;">
                      ${badgeHtml}
                      <h2 style="margin: 0 0 14px 0; color: #0f172a; font-size: 20px; font-weight: 700;">${title}</h2>
                      <p style="margin: 0 0 10px 0; font-size: 15px; color: #1e293b;"><strong>${greeting}</strong></p>
                      ${intro ? `<p style="margin: 0 0 16px 0; font-size: 14px; color: #334155;">${intro}</p>` : ''}
                      ${detailsHtml}
                      ${buttonsHtml}
                      ${footerSection}
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f8fafc; padding: 18px 28px; text-align: center; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px;">
                      <p style="margin: 0 0 4px 0;">Email gửi tự động từ <strong>${appName}</strong> qua Gmail SMTP Service.</p>
                      <p style="margin: 0;">© ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;
    }
  }
};

// Hàm escape ký tự đặc biệt chống XSS / HTML Injection
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Hàm kiểm tra và làm sạch URL (chỉ chấp nhận http:// hoặc https://)
function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return null;
}

// Render template dựa trên tên và biến truyền vào
function render(templateName, variables = {}) {
  const tpl = TEMPLATES[templateName];
  if (!tpl) {
    throw new Error(`Template "${templateName}" không tồn tại. Các mẫu hỗ trợ: ${Object.keys(TEMPLATES).join(', ')}`);
  }
  return {
    subject: variables.subject || variables.title || tpl.defaultSubject,
    html: tpl.render(variables)
  };
}

module.exports = {
  TEMPLATES,
  render,
  getSupportedTemplates: () => Object.keys(TEMPLATES),
  escapeHtml,
  sanitizeUrl
};
