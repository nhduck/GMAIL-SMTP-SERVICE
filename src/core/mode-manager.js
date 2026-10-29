// Mode Manager: Quản lý trạng thái SANDBOX vs LIVE_GMAIL & Cấu hình Webhook hai chiều

const DEFAULT_WEBHOOK_URL = 'http://localhost:4000/api/webhook/email-reply';
const DEFAULT_WEBHOOK_SECRET = 'sec_seminar_webhook_key';

const state = {
  mode: process.env.MODE || 'SANDBOX', // 'SANDBOX' | 'LIVE_GMAIL'
  gmailUser: process.env.GMAIL_USER || '',
  gmailAppPassword: process.env.GMAIL_APP_PASSWORD || '',
  webhookUrl: process.env.WEBHOOK_URL || DEFAULT_WEBHOOK_URL,
  webhookSecret: process.env.WEBHOOK_SECRET || DEFAULT_WEBHOOK_SECRET
};

// Che địa chỉ email: abcdef@gmail.com -> abc***@gmail.com
function maskEmail(email) {
  if (!email) return null;
  const [local, domain] = String(email).split('@');
  return `${local.slice(0, 3)}***@${domain || '***'}`;
}

module.exports = {
  getMode: () => state.mode,
  setMode: (newMode) => {
    if (['SANDBOX', 'LIVE_GMAIL'].includes(newMode)) {
      state.mode = newMode;
      return true;
    }
    return false;
  },
  // includePrivate = true chỉ dùng cho request quản trị (localhost hoặc có API Key)
  getConfig: (includePrivate = false) => {
    const cfg = {
      mode: state.mode,
      gmailUser: maskEmail(state.gmailUser),
      isConfigured: Boolean(state.gmailUser && state.gmailAppPassword)
    };
    if (includePrivate) {
      cfg.rawGmailUser = state.gmailUser || null;
      cfg.webhookUrl = state.webhookUrl;
      cfg.hasWebhookSecret = Boolean(state.webhookSecret);
    }
    return cfg;
  },
  updateCredentials: ({ user, appPassword, webhookUrl, webhookSecret }) => {
    if (user) state.gmailUser = String(user).trim();
    if (appPassword) state.gmailAppPassword = String(appPassword);
    if (webhookUrl !== undefined) state.webhookUrl = webhookUrl || DEFAULT_WEBHOOK_URL;
    if (webhookSecret !== undefined) state.webhookSecret = webhookSecret || DEFAULT_WEBHOOK_SECRET;
  },
  getCredentials: () => ({
    user: state.gmailUser,
    pass: state.gmailAppPassword
  }),
  getWebhookSecret: () => state.webhookSecret || DEFAULT_WEBHOOK_SECRET,
  getWebhookUrl: () => {
    let url = state.webhookUrl || DEFAULT_WEBHOOK_URL;
    if (url.includes('/api/email-received')) {
      url = url.replace('/api/email-received', '/api/webhook/email-reply');
    }
    return url;
  }
};
