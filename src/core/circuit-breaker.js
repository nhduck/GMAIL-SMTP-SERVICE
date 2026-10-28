// Circuit Breaker: Cơ chế ngắt mạch thông minh bảo vệ tài khoản Gmail
// Chống bị Google chặn IP hoặc tạm khóa tài khoản khi có sự cố mạng/spam

class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5; // Số lần lỗi liên tiếp để ngắt
    this.resetTimeout = options.resetTimeout || 30000;      // 30 giây chờ trước khi thử lại (HALF_OPEN)

    this.state = 'CLOSED'; // 'CLOSED' (bình thường), 'OPEN' (ngắt), 'HALF_OPEN' (thử nghiệm)
    this.consecutiveFailures = 0;
    this.lastFailureTime = null;
    this.lastError = null;
    this.trippedCount = 0;
    this.halfOpenInFlight = false; // Chỉ cho phép đúng 1 request thăm dò khi đang ở HALF_OPEN
  }

  canExecute() {
    if (this.state === 'CLOSED') {
      return true;
    }

    if (this.state === 'OPEN') {
      const now = Date.now();
      if (now - this.lastFailureTime > this.resetTimeout) {
        console.log('[Circuit Breaker] Hết thời gian chờ, chuyển sang trạng thái HALF_OPEN để thăm dò (1 request).');
        this.state = 'HALF_OPEN';
        this.halfOpenInFlight = true;
        return true;
      }
      return false;
    }

    // Trạng thái HALF_OPEN: chỉ cho phép 1 request duy nhất đi qua để thử nghiệm
    if (!this.halfOpenInFlight) {
      this.halfOpenInFlight = true;
      return true;
    }
    return false;
  }

  recordSuccess() {
    if (this.state === 'HALF_OPEN') {
      console.log('[Circuit Breaker] Kết nối Gmail đã phục hồi! Chuyển trạng thái về CLOSED.');
    }
    this.consecutiveFailures = 0;
    this.state = 'CLOSED';
    this.lastError = null;
    this.halfOpenInFlight = false;
  }

  recordFailure(error) {
    this.consecutiveFailures += 1;
    this.lastFailureTime = Date.now();
    this.lastError = error ? (error.message || String(error)) : 'Unknown error';
    this.halfOpenInFlight = false;

    console.warn(`[Circuit Breaker] Gặp lỗi (${this.consecutiveFailures}/${this.failureThreshold}): ${this.lastError}`);

    if (this.consecutiveFailures >= this.failureThreshold || this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.trippedCount += 1;
      console.error('🚨 [Circuit Breaker TRIPPED] Ngắt mạch khẩn cấp! Ngừng gửi tiếp để bảo vệ tài khoản Gmail.');
    }
  }

  getStatus() {
    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      failureThreshold: this.failureThreshold,
      lastError: this.lastError,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
      trippedCount: this.trippedCount
    };
  }

  manualReset() {
    this.state = 'CLOSED';
    this.consecutiveFailures = 0;
    this.lastError = null;
    this.halfOpenInFlight = false;
    console.log('[Circuit Breaker] Đã thiết lập lại trạng thái thủ công về CLOSED.');
  }
}

// Singleton Circuit Breaker cho toàn hệ thống
module.exports = new CircuitBreaker();
