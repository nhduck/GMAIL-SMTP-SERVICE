// Mode Manager: Quản lý trạng thái SANDBOX vs LIVE_GMAIL

const state = {
  mode: process.env.MODE || 'SANDBOX', // 'SANDBOX' | 'LIVE_GMAIL'
  gmailUser: process.env.GMAIL_USER || '',
  gmailAppPassword: process.env.GMAIL_APP_PASSWORD || '',
  webhookUrl: process.env.WEBHOOK_URL || ''
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
    }
    return cfg;
  },
  updateCredentials: ({ user, appPassword, webhookUrl }) => {
    if (user) state.gmailUser = String(user).trim();
    if (appPassword) state.gmailAppPassword = String(appPassword);
    if (webhookUrl !== undefined) state.webhookUrl = webhookUrl;
  },
  getCredentials: () => ({
    user: state.gmailUser,
    pass: state.gmailAppPassword
  })
};
