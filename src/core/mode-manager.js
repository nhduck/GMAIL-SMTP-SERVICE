// Mode Manager: Quản lý trạng thái SANDBOX vs LIVE_GMAIL

const state = {
  mode: process.env.MODE || 'SANDBOX', // 'SANDBOX' | 'LIVE_GMAIL'
  gmailUser: process.env.GMAIL_USER || '',
  gmailAppPassword: process.env.GMAIL_APP_PASSWORD || '',
  webhookUrl: process.env.WEBHOOK_URL || ''
};

module.exports = {
  getMode: () => state.mode,
  setMode: (newMode) => {
    if (['SANDBOX', 'LIVE_GMAIL'].includes(newMode)) {
      state.mode = newMode;
      return true;
    }
    return false;
  },
  getConfig: () => ({
    mode: state.mode,
    gmailUser: state.gmailUser ? `${state.gmailUser.slice(0, 3)}***@gmail.com` : null,
    isConfigured: Boolean(state.gmailUser && state.gmailAppPassword),
    webhookUrl: state.webhookUrl
  }),
  updateCredentials: ({ user, appPassword, webhookUrl }) => {
    if (user) state.gmailUser = user;
    if (appPassword) state.gmailAppPassword = appPassword;
    if (webhookUrl !== undefined) state.webhookUrl = webhookUrl;
  },
  getCredentials: () => ({
    user: state.gmailUser,
    pass: state.gmailAppPassword
  })
};
