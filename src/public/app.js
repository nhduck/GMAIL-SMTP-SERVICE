/**
 * Dashboard Client Controller
 * Thành viên phụ trách: Thành viên 3
 */

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

// Test Send Form
document.getElementById('testSendForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const to = document.getElementById('testTo').value;
  const subject = document.getElementById('testSubject').value;
  const html = document.getElementById('testHtml').value;
  const statusBox = document.getElementById('testStatus');

  statusBox.innerText = 'Đang gửi...';
  statusBox.style.color = '#38bdf8';

  try {
    const res = await fetch('/api/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, html })
    });
    const result = await res.json();
    if (res.ok) {
      statusBox.innerText = `✓ ${result.message}`;
      statusBox.style.color = '#10b981';
      loadMails();
    } else {
      statusBox.innerText = `✕ Lỗi: ${result.error}`;
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
  return str.replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}

// Initial Boot
loadMails();
connectWebSocket();
