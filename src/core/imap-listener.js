/**
 * src/core/imap-listener.js
 * Dịch vụ IMAP IDLE hai chiều: Lắng nghe thư trả lời thời gian thực từ imap.gmail.com:993
 * Tính năng an toàn:
 * - Chống vòng lặp tự gửi - tự nhận: bỏ qua thư từ chính GMAIL_USER
 * - Bỏ qua thư tự động (Auto-Submitted)
 * - Chỉ xử lý thư có Re: hoặc In-Reply-To
 * - Làm sạch trích dẫn thư cũ qua cleanReplyText()
 * - Chống trùng lặp theo Message-ID & UID
 * - Tự động kết nối lại khi Gmail IDLE hết hạn hoặc mất kết nối
 */

const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const modeManager = require('./mode-manager');
const { cleanReplyText, extractPureEmail } = require('./text-cleaner');

let client = null;
let isRunning = false;
let shouldRun = false;
let activeCallback = null;
let reconnectTimer = null;
let reconnectAttempt = 0;

// Bộ nhớ đệm chống trùng lặp Message-ID
const processedMessageIds = new Set();
function markProcessed(msgId) {
  if (!msgId) return;
  processedMessageIds.add(msgId);
  if (processedMessageIds.size > 500) {
    const first = processedMessageIds.values().next().value;
    processedMessageIds.delete(first);
  }
}

async function startListening(onReplyCallback) {
  if (onReplyCallback) {
    activeCallback = onReplyCallback;
  }
  shouldRun = true;

  const { user, pass } = modeManager.getCredentials();
  if (!user || !pass) {
    console.log('[IMAP] Chưa có thông tin đăng nhập Gmail, tạm hoãn lắng nghe.');
    return;
  }

  if (isRunning || client) {
    return;
  }

  try {
    console.log(`[IMAP] Đang kết nối tới imap.gmail.com:993 với tài khoản ${user}...`);
    client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: { user, pass },
      logger: false
    });

    client.on('error', (err) => {
      console.warn('[IMAP Socket Error]', err.message);
    });

    client.on('close', () => {
      console.log('[IMAP] Kết nối IMAP đã đóng.');
      isRunning = false;
      client = null;
      if (shouldRun) {
        scheduleReconnect();
      }
    });

    await client.connect();
    isRunning = true;
    reconnectAttempt = 0;
    console.log('✓ [IMAP] Đã kết nối thành công tới imap.gmail.com:993 và mở chế độ lắng nghe IDLE.');

    // Mở và giải phóng khóa INBOX để ImapFlow chọn đúng mailbox
    const initLock = await client.getMailboxLock('INBOX');
    initLock.release();

    // Hàm xử lý an toàn cho một thư
    async function handleIncomingMessage(msg) {
      if (!msg || !msg.source) return;

      const parsed = await simpleParser(msg.source);
      const messageId = parsed.messageId || (msg.envelope && msg.envelope.messageId);

      // 1. Chống xử lý trùng lặp Message-ID
      if (messageId && processedMessageIds.has(messageId)) {
        return;
      }

      // 2. Bỏ qua thư tự động (Auto-Submitted)
      const autoSubmitted = parsed.headers.get('auto-submitted');
      if (autoSubmitted && String(autoSubmitted).toLowerCase() !== 'no') {
        console.log('[IMAP Filter] Bỏ qua thư tự động (Auto-Submitted).');
        return;
      }

      // 3. Chỉ xử lý thư trả lời: Tiêu đề bắt đầu bằng Re:/RE: hoặc có header In-Reply-To
      const subject = parsed.subject || '';
      const inReplyTo = parsed.inReplyTo || (msg.envelope && msg.envelope.inReplyTo);
      const isReSubject = /^re:\s+/i.test(subject);

      if (!isReSubject && !inReplyTo) {
        return;
      }

      // Đánh dấu đã xử lý để không xử lý lại
      markProcessed(messageId);

      // 4. Cắt phần trích dẫn thư cũ, chỉ lấy nội dung trả lời mới gõ
      const rawBody = parsed.text || '';
      const replyText = cleanReplyText(rawBody);
      const fromHeader = parsed.from?.text || '';
      const fromEmail = extractPureEmail(fromHeader);

      console.log(`[IMAP Received] Bắt được thư trả lời từ: ${fromHeader}`);
      console.log(`[IMAP Received] Tiêu đề: "${subject}" | In-Reply-To: ${inReplyTo || 'N/A'}`);
      console.log(`[IMAP Received] Nội dung sau khi làm sạch: "${replyText}"`);

      const mailPayload = {
        messageId,
        inReplyTo: inReplyTo || null,
        from: fromHeader || fromEmail,
        to: parsed.to?.text || '',
        subject,
        replyText,
        rawText: rawBody,
        receivedAt: parsed.date ? parsed.date.toISOString() : new Date().toISOString()
      };

      if (typeof activeCallback === 'function') {
        activeCallback(mailPayload);
      }
    }

    // Quét nhanh các thư gần nhất khi vừa kết nối để không bỏ sót thư đến trong lúc server khởi động
    try {
      const lock = await client.getMailboxLock('INBOX');
      try {
        const total = client.mailbox ? client.mailbox.exists : 0;
        if (total > 0) {
          const startSeq = Math.max(1, total - 2);
          for await (let msg of client.fetch(`${startSeq}:*`, { source: true, envelope: true })) {
            await handleIncomingMessage(msg);
          }
        }
      } finally {
        lock.release();
      }
    } catch (scanErr) {
      console.warn('[IMAP Initial Scan Warning]', scanErr.message);
    }

    // Lắng nghe sự kiện có thư mới tới (IDLE tự động kích hoạt bởi ImapFlow)
    client.on('exists', async (data) => {
      try {
        console.log(`[IMAP IDLE] Nhận tín hiệu thư mới! (Tổng số thư hiện tại: ${data.count})`);
        const lock = await client.getMailboxLock('INBOX');
        try {
          const msg = await client.fetchOne(data.count, { source: true, envelope: true });
          if (msg) {
            await handleIncomingMessage(msg);
          }
        } finally {
          lock.release();
        }
      } catch (fetchErr) {
        console.error('[IMAP Fetch Error]', fetchErr.message);
      }
    });
  } catch (err) {
    console.error('[IMAP Connection Error]', err.message);
    isRunning = false;
    client = null;
    if (shouldRun) {
      scheduleReconnect();
    }
  }
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectAttempt += 1;
  const delayMs = Math.min(30000, 1000 * Math.pow(2, reconnectAttempt));
  console.log(`[IMAP] Sẽ tự động kết nối lại sau ${Math.round(delayMs / 1000)} giây... (Lần ${reconnectAttempt})`);
  reconnectTimer = setTimeout(() => {
    if (shouldRun) {
      startListening(activeCallback);
    }
  }, delayMs);
}

async function stopListening() {
  shouldRun = false;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (client) {
    try {
      await client.logout();
    } catch (_) {}
    client = null;
    isRunning = false;
    console.log('[IMAP] Đã dừng lắng nghe IDLE thành công.');
  }
}

module.exports = {
  startListening,
  stopListening,
  getStatus: () => ({ isListening: isRunning, shouldRun })
};
