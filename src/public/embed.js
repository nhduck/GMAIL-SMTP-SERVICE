/**
 * <mail-widget> Web Component: Nhúng Form gửi email 1 dòng chuẩn Bootstrap
 * Thành viên phụ trách: Thành viên 2
 */

class MailWidget extends HTMLElement {
  connectedCallback() {
    const target = this.getAttribute('target') || 'admin@example.com';
    const title = this.getAttribute('title') || 'Gửi Thông Điệp Đến Chúng Tôi';
    const btnText = this.getAttribute('button-text') || 'Gửi Ngay';

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          max-width: 480px;
          margin: 1rem auto;
        }
        .widget-card {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(220, 225, 235, 0.8);
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
          box-sizing: border-box;
        }
        h3 { margin-top: 0; color: #1e293b; font-size: 1.25rem; }
        .form-group { margin-bottom: 14px; }
        label { display: block; margin-bottom: 6px; font-size: 0.85rem; color: #475569; font-weight: 500; }
        input, textarea {
          width: 100%;
          padding: 10px 14px;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          font-size: 0.95rem;
          box-sizing: border-box;
          outline: none;
          transition: border-color 0.2s;
        }
        input:focus, textarea:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15); }
        button {
          width: 100%;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          color: white;
          padding: 12px;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.1s, opacity 0.2s;
        }
        button:hover { opacity: 0.95; }
        button:active { transform: scale(0.99); }
        .status { margin-top: 12px; font-size: 0.9rem; text-align: center; }
        .status.success { color: #10b981; }
        .status.error { color: #ef4444; }
      </style>
      <div class="widget-card">
        <h3>${title}</h3>
        <form id="mailForm">
          <div class="form-group">
            <label>Email của bạn:</label>
            <input type="email" id="senderEmail" required placeholder="name@example.com" />
          </div>
          <div class="form-group">
            <label>Nội dung:</label>
            <textarea id="messageContent" rows="3" required placeholder="Nhập nội dung..."></textarea>
          </div>
          <button type="submit" id="submitBtn">${btnText}</button>
          <div class="status" id="statusMsg"></div>
        </form>
      </div>
    `;

    const form = this.shadowRoot.getElementById('mailForm');
    const statusMsg = this.shadowRoot.getElementById('statusMsg');
    const submitBtn = this.shadowRoot.getElementById('submitBtn');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const sender = this.shadowRoot.getElementById('senderEmail').value;
      const content = this.shadowRoot.getElementById('messageContent').value;

      submitBtn.disabled = true;
      submitBtn.innerText = 'Đang gửi...';
      statusMsg.innerText = '';

      try {
        const res = await fetch('/api/v1/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: target,
            subject: `Tin nhắn từ ${sender}`,
            html: `<p><b>Người gửi:</b> ${sender}</p><p>${content}</p>`
          })
        });

        if (res.ok) {
          statusMsg.className = 'status success';
          statusMsg.innerText = '✓ Đã gửi email thành công!';
          form.reset();
        } else {
          throw new Error('Không thể gửi email');
        }
      } catch (err) {
        statusMsg.className = 'status error';
        statusMsg.innerText = '✕ Có lỗi xảy ra khi gửi.';
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = btnText;
      }
    });
  }
}

customElements.define('mail-widget', MailWidget);
console.log('✓ [MailWidget] Web Component đã sẵn sàng sử dụng: <mail-widget target="..."></mail-widget>');
