/**
 * IMAP IDLE Listener: Lắng nghe thư mới thời gian thực từ imap.gmail.com:993
 * Thành viên phụ trách: Thành viên 2
 */

const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const modeManager = require('./mode-manager');

let client = null;
let isListening = false;

module.exports = {
  startListening: async (onNewMail) => {
    const { user, pass } = modeManager.getCredentials();
    if (!user || !pass) {
      console.log('[IMAP] Bỏ qua khởi động do chưa cấu hình Gmail credentials.');
      return;
    }

    try {
      client = new ImapFlow({
        host: 'imap.gmail.com',
        port: 993,
        secure: true,
        auth: { user, pass },
        logger: false
      });

      await client.connect();
      console.log('[IMAP] Đã kết nối thành công tới imap.gmail.com:993');

      // Mở hộp thư INBOX
      const lock = await client.getMailboxLock('INBOX');
      isListening = true;

      // Lắng nghe sự kiện thư mới (exists)
      client.on('exists', async (data) => {
        console.log(`[IMAP IDLE] Phát hiện email mới! (Tổng số thư: ${data.count})`);
        try {
          const message = await client.fetchOne(data.count, { source: true });
          const parsed = await simpleParser(message.source);

          const mailPayload = {
            id: parsed.messageId,
            from: parsed.from?.text,
            to: parsed.to?.text,
            subject: parsed.subject,
            text: parsed.text,
            html: parsed.html,
            date: parsed.date
          };

          if (typeof onNewMail === 'function') {
            onNewMail(mailPayload);
          }
        } catch (err) {
          console.error('[IMAP Fetch Error]', err.message);
        }
      });

      // Lệnh IDLE duy trì socket
      await client.idle();
    } catch (err) {
      console.error('[IMAP Connection Error]', err.message);
    }
  },
  stopListening: async () => {
    if (client) {
      await client.logout();
      client = null;
      isListening = false;
    }
  },
  getStatus: () => ({ isListening })
};
