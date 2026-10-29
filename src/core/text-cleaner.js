/**
 * src/core/text-cleaner.js
 * Bộ làm sạch nội dung thư phản hồi (Inbound Email Reply Cleaner)
 * Nhiệm vụ: Cắt bỏ hoàn toàn khối trích dẫn thư cũ (Quote markers: On... wrote, Vào... đã viết, > ...)
 * Chỉ giữ lại phần Quản lý mới gõ vào để tránh nhận diện sai từ khóa trong thư cũ.
 */

function cleanReplyText(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return '';
  }

  // Chuẩn hóa xuống dòng về \n
  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');

  const cleanLines = [];

  // Các regex nhận diện bắt đầu khối trích dẫn thư cũ
  const quoteStartRegexes = [
    /^\s*On\s+.+wrote:\s*$/i,                  // On Thu, Oct 29, 2026 at 10:00 AM ... wrote:
    /^\s*Vào\s+.+đã viết:\s*$/i,              // Vào Th 5, 29 thg 10, 2026 lúc 10:00 ... đã viết:
    /^\s*---+\s*Original Message\s*---+/i,     // -----Original Message-----
    /^\s*---+\s*Tin nhắn gốc\s*---+/i,         // -----Tin nhắn gốc-----
    /^\s*_{10,}/,                              // ________________________________ (Outlook separator)
    /^\s*From:\s+.+$/i,                        // From: sender@domain
    /^\s*Sent:\s+.+$/i                         // Sent: date
  ];

  for (let line of lines) {
    const trimmed = line.trim();

    // 1. Nếu gặp dòng bắt đầu bằng ký tự trích dẫn '>', dừng thu thập
    if (trimmed.startsWith('>')) {
      break;
    }

    // 2. Nếu dòng khớp với một trong các mẫu mở đầu trích dẫn, dừng thu thập
    const isQuoteHeader = quoteStartRegexes.some((re) => re.test(trimmed));
    if (isQuoteHeader) {
      break;
    }

    // 3. Nếu gặp chữ ký chuẩn RFC ('-- ' hoặc '--'), dừng thu thập
    if (trimmed === '--' || trimmed === '-- ') {
      break;
    }

    cleanLines.push(line);
  }

  // Lọc lấy tối đa 3 dòng văn bản đầu tiên không rỗng (quản lý chỉ gõ 1-2 từ)
  const validLines = cleanLines
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 3);

  return validLines.join(' ').trim();
}

/**
 * Trích xuất địa chỉ email thuần từ chuỗi RFC 5322 From:
 * "Quản Lý" <manager@domain.com> -> manager@domain.com
 * manager@domain.com -> manager@domain.com
 */
function extractPureEmail(fromHeader) {
  if (!fromHeader || typeof fromHeader !== 'string') {
    return '';
  }
  const match = fromHeader.match(/<([^>]+)>/);
  if (match && match[1]) {
    return match[1].trim().toLowerCase();
  }
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
  const matchDirect = fromHeader.match(emailRegex);
  return matchDirect ? matchDirect[1].trim().toLowerCase() : fromHeader.trim().toLowerCase();
}

module.exports = {
  cleanReplyText,
  extractPureEmail
};

