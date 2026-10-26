// Dashboard Client Controller

let mails = [];
let currentMode = 'SANDBOX';

// DOM Elements
const mailList = document.getElementById('mailList');
const mailViewer = document.getElementById('mailViewer');
const mailCount = document.getElementById('mailCount');
const btnSandbox = document.getElementById('btnSandbox');
const btnLive = document.getElementById('btnLive');
const currentModeLabel = document.getElementById('currentModeLabel');

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

async function switchMode(mode) {
  try {
    const res = await fetch('/api/v1/config/mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    const res = await fetch('/api/v1/mails');
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
    mailList.innerHTML = '<div class="empty-state">Hòm thư trống. Hãy gửi thử 1 email!</div>';
    mailViewer.innerHTML = '<div class="empty-preview">Chọn một email bên trái để xem nội dung chi tiết</div>';
    return;
  }

  mailList.innerHTML = mails.map(m => `
    <div class="mail-item" onclick="selectMail('${m.id}')">
      <div class="mail-item-title">${escapeHtml(m.subject)}</div>
      <div class="mail-item-to">Tới: ${escapeHtml(m.to)}</div>
      <div class="mail-item-time">${new Date(m.receivedAt).toLocaleTimeString()}</div>
    </div>
  `).join('');
}

window.selectMail = function (id) {
  const mail = mails.find(m => m.id === id);
  if (!mail) return;

  mailViewer.innerHTML = `
    <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 20px;">
      <h2 style="margin: 0 0 8px 0; color: #0f172a;">${escapeHtml(mail.subject)}</h2>
      <div style="font-size: 0.9rem; color: #64748b;">
        <div><b>Người nhận:</b> ${escapeHtml(mail.to)}</div>
        <div><b>Thời gian:</b> ${new Date(mail.receivedAt).toLocaleString()}</div>
      </div>
    </div>
    <div class="mail-body-content">
      ${mail.html || `<pre style="color: #334155;">${escapeHtml(mail.text)}</pre>`}
    </div>
  `;
};

// Clear Mails
document.getElementById('btnClearMails').addEventListener('click', async () => {
  await fetch('/api/v1/mails', { method: 'DELETE' });
  mails = [];
  renderMailList();
});

// Preset Switcher Logic
const btnPresetVerify = document.getElementById('btnPresetVerify');
const btnPresetReset = document.getElementById('btnPresetReset');
const btnPresetCustom = document.getElementById('btnPresetCustom');

const selectedEndpointInput = document.getElementById('selectedEndpoint');
const groupName = document.getElementById('groupName');
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
  groupSubject.style.display = 'none';
  groupVerifyUrl.style.display = 'block';
  groupResetUrl.style.display = 'none';
  groupHtml.style.display = 'none';
});

btnPresetReset.addEventListener('click', () => {
  setPresetActive(btnPresetReset);
  selectedEndpointInput.value = '/api/v1/password-reset';
  groupName.style.display = 'block';
  groupSubject.style.display = 'none';
  groupVerifyUrl.style.display = 'none';
  groupResetUrl.style.display = 'block';
  groupHtml.style.display = 'none';
});

btnPresetCustom.addEventListener('click', () => {
  setPresetActive(btnPresetCustom);
  selectedEndpointInput.value = '/api/v1/send';
  groupName.style.display = 'none';
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

  statusBox.innerText = 'Đang gửi...';
  statusBox.style.color = '#38bdf8';

  let payload = { to };

  if (endpoint === '/api/v1/verify-email') {
    payload.name = name;
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (res.ok) {
      const extraInfo = result.otp ? ` (Mã OTP sinh ngẫu nhiên: ${result.otp})` : '';
      statusBox.innerText = `✓ ${result.message}${extraInfo}`;
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
  const statusBox = document.getElementById('configStatus');

  statusBox.innerText = 'Đang lưu...';
  try {
    const res = await fetch('/api/v1/config/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, appPassword, webhookUrl })
    });
    const result = await res.json();
    statusBox.innerText = '✓ ' + result.message;
    statusBox.style.color = '#10b981';
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
      if (data.type === 'NEW_MAIL' || data.type === 'INBOUND_MAIL') {
        loadMails();
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
loadMails();
connectWebSocket();
