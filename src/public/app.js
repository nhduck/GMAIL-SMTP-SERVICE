// Dashboard Client Controller

let mails = [];
let currentMode = 'SANDBOX';
let selectedMailId = null;
let previewViewport = 'desktop'; // 'desktop' | 'mobile'

// Hỗ trợ gắn kèm header X-API-Key khi máy chủ bật bảo mật API_KEY
function getStoredApiKey() {
  try {
    return localStorage.getItem('GMAIL_GATEWAY_API_KEY') || '';
  } catch (_) {
    return '';
  }
}

function buildApiHeaders(hasJsonBody = false) {
  const headers = {};
  if (hasJsonBody) {
    headers['Content-Type'] = 'application/json';
  }
  const apiKey = getStoredApiKey();
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }
  return headers;
}

// DOM Elements
const mailList = document.getElementById('mailList');
const mailViewer = document.getElementById('mailViewer');
const mailCount = document.getElementById('mailCount');
const btnSandbox = document.getElementById('btnSandbox');
const btnLive = document.getElementById('btnLive');
const currentModeLabel = document.getElementById('currentModeLabel');
const cfgApiKeyInput = document.getElementById('cfgApiKey');

if (cfgApiKeyInput) {
  cfgApiKeyInput.value = getStoredApiKey();
}

// Tab Navigation
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// Mode Toggle
btnSandbox.addEventListener('click', () => switchMode('SANDBOX'));
btnLive.addEventListener('click', () => switchMode('LIVE_GMAIL'));

async function loadInitialConfig() {
  try {
    const res = await fetch('/api/v1/config', { headers: buildApiHeaders() });
    if (!res.ok) return;
    const json = await res.json();
    if (json.success && json.data) {
      updateModeUI(json.data.mode || 'SANDBOX');
      if (json.data.rawGmailUser) {
        if (document.getElementById('cfgUser')) {
          document.getElementById('cfgUser').value = json.data.rawGmailUser;
        }
        // Tự động điền email người nhận mặc định ở tab Kiểm Thử Gửi Mail bằng chính Gmail đã cấu hình
        const testToInput = document.getElementById('testTo');
        if (testToInput && (!testToInput.value || testToInput.value === 'student@tdtu.edu.vn')) {
          testToInput.value = json.data.rawGmailUser;
        }
      }
      if (json.data.isConfigured && document.getElementById('cfgAppPassword')) {
        document.getElementById('cfgAppPassword').placeholder = '✓ Đã nạp sẵn App Password (để trống nếu giữ nguyên)';
      }
      if (json.data.webhookUrl && document.getElementById('cfgWebhookUrl')) {
        document.getElementById('cfgWebhookUrl').value = json.data.webhookUrl;
      }
    }
  } catch (err) {
    console.error(err);
  }
}

async function switchMode(mode) {
  try {
    const res = await fetch('/api/v1/config/mode', {
      method: 'POST',
      headers: buildApiHeaders(true),
      body: JSON.stringify({ mode })
    });
    if (res.ok) {
      updateModeUI(mode);
    }
  } catch (err) {
    console.error(err);
  }
}

function updateModeUI(mode) {
  currentMode = mode;
  if (mode === 'SANDBOX') {
    btnSandbox.classList.add('active');
    btnLive.classList.remove('active');
    currentModeLabel.innerText = 'Sandbox (Ảo)';
  } else {
    btnLive.classList.add('active');
    btnSandbox.classList.remove('active');
    currentModeLabel.innerText = 'Live (Thật)';
  }
}

// Fetch Mails
async function loadMails() {
  try {
    const res = await fetch('/api/v1/mails', { headers: buildApiHeaders() });
    const json = await res.json();
    if (json.success) {
      mails = json.data;
      renderMailList();
    }
  } catch (err) {
    console.error(err);
  }
}

function renderMailList() {
  mailCount.innerText = mails.length;
  if (mails.length === 0) {
    selectedMailId = null;
    mailList.innerHTML = '<div class="empty-state">Hòm thư trống. Hãy gửi thử 1 email!</div>';
    mailViewer.innerHTML = '<div class="empty-preview">Chọn một email bên trái để xem nội dung chi tiết</div>';
    return;
  }

  mailList.innerHTML = mails.map(m => `
    <div class="mail-item ${m.id === selectedMailId ? 'selected' : ''}" onclick="selectMail('${m.id}')">
      <div class="mail-item-title">${escapeHtml(m.subject)}</div>
      <div class="mail-item-to">Tới: ${escapeHtml(m.to)}</div>
      <div class="mail-item-time">${new Date(m.receivedAt).toLocaleTimeString()} • ${m.mode === 'LIVE_GMAIL' ? 'Live Gmail' : 'Sandbox'}</div>
    </div>
  `).join('');

  // Tự động hiển thị bức thư đầu tiên nếu chưa chọn bức thư nào
  if (!selectedMailId || !mails.some(m => m.id === selectedMailId)) {
    window.selectMail(mails[0].id, false);
  }
}

window.setPreviewViewport = function (mode) {
  previewViewport = mode === 'mobile' ? 'mobile' : 'desktop';
  const iframe = document.getElementById('mailPreviewIframe');
  const btnDesktop = document.getElementById('btnViewportDesktop');
  const btnMobile = document.getElementById('btnViewportMobile');
  if (iframe) {
    iframe.classList.toggle('mobile-frame', previewViewport === 'mobile');
  }
  if (btnDesktop && btnMobile) {
    btnDesktop.classList.toggle('active', previewViewport === 'desktop');
    btnMobile.classList.toggle('active', previewViewport === 'mobile');
  }
};

window.toggleReplyBox = function () {
  const box = document.getElementById('replyBox');
  if (box) {
    box.style.display = box.style.display === 'none' ? 'block' : 'none';
  }
};

window.submitSandboxReply = async function (mailId) {
  const input = document.getElementById('replyTextInput');
  const statusEl = document.getElementById('replyStatus');
  const text = input ? input.value.trim() : '';
  if (!text) return;

  statusEl.innerText = 'Đang gửi phản hồi qua Webhook Inbound...';
  statusEl.style.color = '#38bdf8';

  try {
    const res = await fetch('/api/v1/sandbox/reply', {
      method: 'POST',
      headers: buildApiHeaders(true),
      body: JSON.stringify({ mailId, replyText: text })
    });
    const json = await res.json();
    if (res.ok) {
      const wh = json.webhookResult || {};
      if (wh.status === 401) {
        statusEl.innerText = '✕ Webhook bị từ chối: Sai mã xác thực X-Webhook-Secret!';
        statusEl.style.color = '#ef4444';
      } else if (wh.data && wh.data.ignored) {
        statusEl.innerText = `⚠️ Ứng dụng đã nhận phản hồi nhưng bỏ qua: ${wh.data.message || wh.data.reason}`;
        statusEl.style.color = '#f59e0b';
      } else if (wh.data && wh.data.ambiguous) {
        statusEl.innerText = 'ℹ️ Cú pháp chưa rõ ràng. Đã gửi email nhắc nhở cú pháp cho Quản lý.';
        statusEl.style.color = '#38bdf8';
        setTimeout(() => loadMails(), 400);
      } else if (wh.data && wh.data.leave) {
        const st = wh.data.leave.status;
        statusEl.innerText = `✓ Đã xử lý ${st === 'APPROVED' ? 'DUYỆT' : 'TỪ CHỐI'} đơn #${wh.data.leave.id} thành công! Email kết quả đã gửi về cho Nhân viên.`;
        statusEl.style.color = '#10b981';
        setTimeout(async () => {
          await loadMails();
          if (mails.length > 0) {
            window.selectMail(mails[0].id, false);
          }
        }, 500);
      } else {
        statusEl.innerText = `✓ ${json.message}`;
        statusEl.style.color = '#10b981';
        setTimeout(() => loadMails(), 400);
      }
    } else {
      statusEl.innerText = `✕ Lỗi: ${json.error || 'Gửi thất bại'}`;
      statusEl.style.color = '#ef4444';
    }
  } catch (err) {
    statusEl.innerText = `✕ Lỗi mạng: ${err.message}`;
    statusEl.style.color = '#ef4444';
  }
};

window.selectMail = function (id, shouldScrollOnMobile = true) {
  const mail = mails.find(m => m.id === id);
  if (!mail) return;
  selectedMailId = id;

  // Cập nhật highlight trong danh sách
  document.querySelectorAll('.mail-item').forEach(el => {
    el.classList.toggle('selected', el.getAttribute('onclick') === `selectMail('${id}')`);
  });

  const isReplyAvailable = currentMode === 'SANDBOX';

  mailViewer.innerHTML = `
    <div class="preview-toolbar">
      <div>
        <h2 style="margin: 0 0 6px 0; color: #0f172a; font-size: 1.15rem;">${escapeHtml(mail.subject)}</h2>
        <div style="font-size: 0.85rem; color: #64748b;">
          <div><b>Người nhận:</b> ${escapeHtml(mail.to)}</div>
          <div><b>Thời gian:</b> ${new Date(mail.receivedAt).toLocaleString()} (${mail.mode === 'LIVE_GMAIL' ? 'Đã gửi qua Live Gmail' : 'Hộp thư ảo Sandbox'})</div>
        </div>
      </div>
      <div style="display: flex; gap: 8px; align-items: center;">
        ${isReplyAvailable ? `<button type="button" class="viewport-btn" onclick="toggleReplyBox()" style="font-weight: 600; color: #0284c7; border-color: #0284c7;">Trả lời thư</button>` : ''}
        <div class="viewport-switcher" title="Chuyển đổi khung nhìn để kiểm tra HTML Email Responsive">
          <button type="button" id="btnViewportDesktop" class="viewport-btn ${previewViewport === 'desktop' ? 'active' : ''}" onclick="setPreviewViewport('desktop')">Desktop</button>
          <button type="button" id="btnViewportMobile" class="viewport-btn ${previewViewport === 'mobile' ? 'active' : ''}" onclick="setPreviewViewport('mobile')">Mobile (375px)</button>
        </div>
      </div>
    </div>

    <!-- Khối Trả Lời Thư Giả Lập Trong Sandbox -->
    <div id="replyBox" style="display: none; margin: 12px 0; padding: 12px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px;">
      <div style="font-weight: 600; font-size: 0.85rem; margin-bottom: 6px; color: #0f172a;">
        Mô phỏng Quản lý Reply qua Email (IMAP &amp; Webhook):
      </div>
      <div style="display: flex; gap: 8px;">
        <input type="text" id="replyTextInput" value="Duyệt" placeholder="Gõ Duyệt hoặc Từ chối..." style="flex: 1; padding: 6px 12px; border: 1px solid #94a3b8; border-radius: 4px; font-size: 0.9rem;" />
        <button type="button" class="btn btn-primary" onclick="submitSandboxReply('${mail.id}')" style="padding: 6px 16px;">Gửi phản hồi</button>
      </div>
      <div id="replyStatus" style="font-size: 0.85rem; margin-top: 6px;"></div>
    </div>

    <div class="mail-preview-stage">
      ${mail.html
        ? `<iframe id="mailPreviewIframe" class="mail-iframe ${previewViewport === 'mobile' ? 'mobile-frame' : ''}" title="Email HTML Preview"></iframe>`
        : `<pre style="color: #334155; width: 100%;">${escapeHtml(mail.text)}</pre>`
      }
    </div>
  `;

  const iframe = document.getElementById('mailPreviewIframe');
  if (iframe && mail.html) {
    iframe.srcdoc = mail.html;
    iframe.onload = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        if (doc && doc.body) {
          iframe.style.height = Math.max(480, doc.body.scrollHeight + 24) + 'px';
        }
      } catch (_) {}
    };
  }

  if (shouldScrollOnMobile && window.innerWidth <= 860) {
    mailViewer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

// Clear Mails
document.getElementById('btnClearMails').addEventListener('click', async () => {
  await fetch('/api/v1/mails', { method: 'DELETE', headers: buildApiHeaders() });
  mails = [];
  renderMailList();
});

// Preset Switcher Logic
const btnPresetVerify = document.getElementById('btnPresetVerify');
const btnPresetReset = document.getElementById('btnPresetReset');
const btnPresetCustom = document.getElementById('btnPresetCustom');

const selectedEndpointInput = document.getElementById('selectedEndpoint');
const groupName = document.getElementById('groupName');
const groupOtp = document.getElementById('groupOtp');
const groupSubject = document.getElementById('groupSubject');
const groupVerifyUrl = document.getElementById('groupVerifyUrl');
const groupResetUrl = document.getElementById('groupResetUrl');
const groupHtml = document.getElementById('groupHtml');

function setPresetActive(btn) {
  [btnPresetVerify, btnPresetReset, btnPresetCustom].forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

btnPresetVerify.addEventListener('click', () => {
  setPresetActive(btnPresetVerify);
  selectedEndpointInput.value = '/api/v1/verify-email';
  groupName.style.display = 'block';
  if (groupOtp) groupOtp.style.display = 'block';
  groupSubject.style.display = 'none';
  groupVerifyUrl.style.display = 'block';
  groupResetUrl.style.display = 'none';
  groupHtml.style.display = 'none';
});

btnPresetReset.addEventListener('click', () => {
  setPresetActive(btnPresetReset);
  selectedEndpointInput.value = '/api/v1/password-reset';
  groupName.style.display = 'block';
  if (groupOtp) groupOtp.style.display = 'none';
  groupSubject.style.display = 'none';
  groupVerifyUrl.style.display = 'none';
  groupResetUrl.style.display = 'block';
  groupHtml.style.display = 'none';
});

btnPresetCustom.addEventListener('click', () => {
  setPresetActive(btnPresetCustom);
  selectedEndpointInput.value = '/api/v1/send';
  groupName.style.display = 'none';
  if (groupOtp) groupOtp.style.display = 'none';
  groupSubject.style.display = 'block';
  groupVerifyUrl.style.display = 'none';
  groupResetUrl.style.display = 'none';
  groupHtml.style.display = 'block';
  if (!document.getElementById('testSubject').value) {
    document.getElementById('testSubject').value = 'Thông báo quan trọng từ hệ thống';
  }
  if (!document.getElementById('testHtml').value) {
    document.getElementById('testHtml').value = '<div style="padding:20px;background:#f1f5f9;border-radius:8px;"><h2>Xin chào!</h2><p>Đây là email HTML mẫu tùy biến với giao diện đẹp mắt.</p></div>';
  }
});

// Test Send Form Submit
document.getElementById('testSendForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const endpoint = selectedEndpointInput.value;
  const to = document.getElementById('testTo').value;
  const name = document.getElementById('testName').value;
  const subject = document.getElementById('testSubject').value;
  const verifyUrl = document.getElementById('testVerifyUrl').value;
  const resetUrl = document.getElementById('testResetUrl').value;
  const html = document.getElementById('testHtml').value;
  const statusBox = document.getElementById('testStatus');

  statusBox.innerText = currentMode === 'LIVE_GMAIL'
    ? 'Đang kết nối smtp.gmail.com:587 và gửi thư (mất khoảng 3-5 giây)...'
    : 'Đang gửi...';
  statusBox.style.color = '#38bdf8';

  let payload = { to };

  if (endpoint === '/api/v1/verify-email') {
    payload.name = name;
    const otpInput = document.getElementById('testOtp');
    let otpVal = otpInput ? otpInput.value.trim() : '';
    // Khi bấm gửi thử trên Dashboard ở chế độ Live Gmail mà để trống cả OTP lẫn verifyUrl, tự tạo 6 số mẫu để tiện kiểm thử
    if (!otpVal && !verifyUrl && currentMode === 'LIVE_GMAIL') {
      otpVal = String(Math.floor(100000 + Math.random() * 900000));
    }
    if (otpVal) payload.otp = otpVal;
    if (verifyUrl) payload.verifyUrl = verifyUrl;
  } else if (endpoint === '/api/v1/password-reset') {
    payload.name = name;
    payload.resetUrl = resetUrl || 'https://myapp.com/reset-password?token=sec_token_demo';
    // Mặc định server sẽ tự áp dụng RESET_TTL_MINUTES (5 phút)
  } else {
    payload.subject = subject || 'Thông báo từ hệ thống';
    payload.html = html || '<p>Email kiểm thử nội dung HTML.</p>';
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: buildApiHeaders(true),
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (res.ok) {
      const extraInfo = result.otp ? ` (Mã OTP: ${result.otp})` : (payload.otp ? ` (Mã OTP đã gửi: ${payload.otp})` : '');
      statusBox.innerText = currentMode === 'LIVE_GMAIL'
        ? `Đã xếp hàng gửi tới ${to}${extraInfo} — đang chờ Gmail SMTP xác nhận...`
        : `✓ ${result.message}${extraInfo}`;
      statusBox.style.color = '#10b981';
      loadMails();
    } else {
      statusBox.innerText = `✕ Lỗi: ${result.error || JSON.stringify(result.details)}`;
      statusBox.style.color = '#ef4444';
    }
  } catch (err) {
    statusBox.innerText = `✕ Lỗi mạng: ${err.message}`;
    statusBox.style.color = '#ef4444';
  }
});

// Config Form
document.getElementById('configForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const user = document.getElementById('cfgUser').value;
  const appPassword = document.getElementById('cfgAppPassword').value;
  const webhookUrl = document.getElementById('cfgWebhookUrl').value;
  const apiKey = cfgApiKeyInput ? cfgApiKeyInput.value.trim() : '';
  const statusBox = document.getElementById('configStatus');

  try {
    if (apiKey) {
      localStorage.setItem('GMAIL_GATEWAY_API_KEY', apiKey);
    } else {
      localStorage.removeItem('GMAIL_GATEWAY_API_KEY');
    }
  } catch (_) {}

  statusBox.innerText = 'Đang lưu...';
  try {
    const res = await fetch('/api/v1/config/credentials', {
      method: 'POST',
      headers: buildApiHeaders(true),
      body: JSON.stringify({ user, appPassword, webhookUrl })
    });
    const result = await res.json();
    if (res.ok) {
      statusBox.innerText = '✓ ' + result.message;
      statusBox.style.color = '#10b981';
      if (user && document.getElementById('testTo')) {
        document.getElementById('testTo').value = user.trim();
      }
      loadInitialConfig();
      loadMails();
    } else {
      statusBox.innerText = '✕ Lỗi: ' + (result.error || 'Không thể lưu cấu hình');
      statusBox.style.color = '#ef4444';
    }
  } catch (err) {
    statusBox.innerText = '✕ Lỗi: ' + err.message;
    statusBox.style.color = '#ef4444';
  }
});

// WebSocket Live Updates
function connectWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${location.host}`);

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'NEW_MAIL' || data.type === 'INBOUND_MAIL' || data.type === 'JOB_COMPLETED') {
        loadMails();
      }
      if (data.type === 'JOB_COMPLETED' && data.job && currentMode === 'LIVE_GMAIL') {
        const statusBox = document.getElementById('testStatus');
        if (statusBox && statusBox.innerText.includes('Đang')) {
          statusBox.innerText = `✓ Đã gửi thành công vào hộp thư Gmail thật (${data.job.to})!`;
          statusBox.style.color = '#10b981';
        }
      }
      if (data.type === 'JOB_MOVED_TO_DLQ' && data.job) {
        const statusBox = document.getElementById('testStatus');
        if (statusBox) {
          statusBox.innerText = `✕ Gửi Gmail thất bại (đã chuyển vào DLQ): ${data.job.error}`;
          statusBox.style.color = '#ef4444';
        }
      }
      if (data.type === 'MODE_CHANGED') {
        updateModeUI(data.mode);
      }
    } catch (e) {
      console.error(e);
    }
  };

  ws.onclose = () => {
    setTimeout(connectWebSocket, 3000);
  };
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function (m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}

// Initial Boot
loadInitialConfig();
loadMails();
connectWebSocket();
