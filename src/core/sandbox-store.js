/**
 * Sandbox Store: Bộ nhớ RAM lưu trữ email ảo trong chế độ Dev Sandbox
 * Thành viên phụ trách: Thành viên 1 & Thành viên 3
 */

const { v4: uuidv4 } = require('uuid');

const virtualInbox = [];

module.exports = {
  addMail: (mailData) => {
    const item = {
      id: uuidv4(),
      from: mailData.from || 'sender@example.com',
      to: mailData.to,
      subject: mailData.subject || '(Không có tiêu đề)',
      text: mailData.text || '',
      html: mailData.html || '',
      receivedAt: new Date().toISOString(),
      mode: 'SANDBOX'
    };
    virtualInbox.unshift(item); // Thư mới nhất ở trên đầu
    // Giới hạn lưu 100 thư gần nhất trong RAM
    if (virtualInbox.length > 100) virtualInbox.pop();
    return item;
  },
  getMails: () => virtualInbox,
  getMailById: (id) => virtualInbox.find(m => m.id === id),
  clearMails: () => {
    virtualInbox.length = 0;
  }
};
