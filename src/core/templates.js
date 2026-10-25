/**
 * Template Engine cho Email: Account Verification, Password Reset & HTML Email
 * Thành viên phụ trách: Thành (Core Backend Lead)
 */

// Bộ mẫu HTML Email Responsive, hỗ trợ Mobile, Desktop và Dark mode
const TEMPLATES = {
  // 1. Mẫu Xác Thực Tài Khoản (Account Verification)
  'verify-email': {
    defaultSubject: 'Xác thực tài khoản của bạn',
    render: (vars = {}) => {
      const name = vars.name || 'Quý khách';
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
      const expiresIn = vars.expiresInMinutes || 15;
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
  }
};

/**
 * Render template dựa trên tên và biến truyền vào
 */
function render(templateName, variables = {}) {
  const tpl = TEMPLATES[templateName];
  if (!tpl) {
    throw new Error(`Template "${templateName}" không tồn tại. Các mẫu hỗ trợ: ${Object.keys(TEMPLATES).join(', ')}`);
  }
  return {
    subject: variables.subject || tpl.defaultSubject,
    html: tpl.render(variables)
  };
}

module.exports = {
  TEMPLATES,
  render,
  getSupportedTemplates: () => Object.keys(TEMPLATES)
};
