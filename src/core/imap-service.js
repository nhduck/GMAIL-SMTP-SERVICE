/**
 * src/core/imap-service.js
 * Quản lý vòng đời dịch vụ IMAP IDLE & kết nối với Webhook Dispatcher
 */

const imapListener = require('./imap-listener');
const webhookDispatcher = require('./webhook-dispatcher');
const modeManager = require('./mode-manager');

let broadcastFunction = null;

function setBroadcast(fn) {
  broadcastFunction = fn;
}

function handleInboundMail(mailPayload) {
  if (typeof broadcastFunction === 'function') {
    broadcastFunction({ type: 'INBOUND_MAIL', data: mailPayload });
  }
  return webhookDispatcher.dispatch(mailPayload);
}

async function syncWithMode(mode) {
  const targetMode = mode || modeManager.getMode();
  if (targetMode === 'LIVE_GMAIL') {
    await imapListener.startListening(handleInboundMail);
  } else {
    await imapListener.stopListening();
  }
}

module.exports = {
  setBroadcast,
  handleInboundMail,
  syncWithMode,
  start: () => imapListener.startListening(handleInboundMail),
  stop: () => imapListener.stopListening(),
  getStatus: () => imapListener.getStatus()
};

