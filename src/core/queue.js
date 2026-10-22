/**
 * Advanced Queue Engine: Hàng đợi bất đồng bộ có Retry Exponential Backoff,
 * Dead-Letter Queue (DLQ), Điều phối luồng và cơ chế Graceful Drain
 * Thành viên phụ trách: Thành (Core Backend)
 */

const { v4: uuidv4 } = require('uuid');

class AsyncEmailQueue {
  constructor(options = {}) {
    this.concurrency = options.concurrency || 2;   // Số worker chạy đồng thời
    this.maxRetries = options.maxRetries || 3;      // Số lần thử lại tối đa trước khi đưa vào DLQ
    this.baseDelayMs = options.baseDelayMs || 1000; // Thời gian chờ cơ sở (1 giây)

    this.queue = [];
    this.activeWorkers = 0;
    this.jobHistory = [];       // Lưu 50 job gần nhất phục vụ giám sát
    this.deadLetterQueue = [];  // Dead-Letter Queue (DLQ) lưu các job hỏng sau 3 lần retry

    // Metrics phục vụ báo cáo hiệu năng môn SOA
    this.metrics = {
      totalEnqueued: 0,
      totalCompleted: 0,
      totalFailed: 0,
      totalRetried: 0,
      totalSentToDlq: 0,
      averageProcessTimeMs: 0
    };

    this.onJobEvent = null; // Callback phát WebSocket ra ngoài
  }

  setEventListener(listener) {
    this.onJobEvent = listener;
  }

  emit(eventType, job) {
    if (typeof this.onJobEvent === 'function') {
      this.onJobEvent({ type: eventType, job: this.serializeJob(job) });
    }
  }

  serializeJob(job) {
    return {
      id: job.id,
      to: job.data.to,
      subject: job.data.subject,
      status: job.status,
      retries: job.retries,
      maxRetries: this.maxRetries,
      enqueuedAt: job.enqueuedAt,
      completedAt: job.completedAt,
      error: job.error,
      movedToDlqAt: job.movedToDlqAt || null
    };
  }

  /**
   * Thêm task vào hàng đợi. Hàm này trả về ngay lập tức để đạt SLA < 45ms.
   */
  enqueue(data, handler) {
    const job = {
      id: uuidv4(),
      data,
      handler,
      status: 'PENDING',
      retries: 0,
      enqueuedAt: new Date().toISOString(),
      completedAt: null,
      error: null
    };

    this.queue.push(job);
    this.jobHistory.unshift(job);
    if (this.jobHistory.length > 50) this.jobHistory.pop();

    this.metrics.totalEnqueued += 1;
    this.emit('JOB_ENQUEUED', job);

    this.scheduleNext();

    return {
      jobId: job.id,
      status: 'QUEUED',
      queueLength: this.queue.length
    };
  }

  scheduleNext() {
    while (this.activeWorkers < this.concurrency && this.queue.length > 0) {
      const job = this.queue.shift();
      this.processJob(job);
    }
  }

  async processJob(job) {
    this.activeWorkers += 1;
    job.status = job.retries > 0 ? 'RETRYING' : 'PROCESSING';
    this.emit('JOB_PROCESSING', job);

    const startTime = Date.now();

    try {
      await job.handler();

      const duration = Date.now() - startTime;
      job.status = 'COMPLETED';
      job.completedAt = new Date().toISOString();
      job.durationMs = duration;

      this.metrics.totalCompleted += 1;
      this.updateAverageProcessTime(duration);
      this.emit('JOB_COMPLETED', job);
    } catch (err) {
      console.error(`[Queue] Job ${job.id} thất bại (Lần ${job.retries + 1}):`, err.message);
      job.error = err.message;

      if (job.retries < this.maxRetries) {
        job.retries += 1;
        this.metrics.totalRetried += 1;

        // Exponential Backoff: delay = baseDelay * (2 ^ (retries - 1))
        const backoffDelay = this.baseDelayMs * Math.pow(2, job.retries - 1);
        console.log(`[Queue] Lên lịch thử lại job ${job.id} sau ${backoffDelay}ms (Exponential Backoff)...`);

        job.status = 'SCHEDULED_RETRY';
        this.emit('JOB_RETRY_SCHEDULED', job);

        setTimeout(() => {
          this.queue.unshift(job);
          this.scheduleNext();
        }, backoffDelay);
      } else {
        // Vượt quá số lần thử lại -> Chuyển vào Dead-Letter Queue (DLQ)
        job.status = 'DEAD_LETTER';
        job.completedAt = new Date().toISOString();
        job.movedToDlqAt = new Date().toISOString();

        this.metrics.totalFailed += 1;
        this.metrics.totalSentToDlq += 1;

        this.deadLetterQueue.unshift(job);
        if (this.deadLetterQueue.length > 100) this.deadLetterQueue.pop();

        console.error(`☠️ [Dead-Letter Queue] Job ${job.id} đã thử ${this.maxRetries} lần thất bại. Đưa vào DLQ.`);
        this.emit('JOB_MOVED_TO_DLQ', job);
      }
    } finally {
      this.activeWorkers -= 1;
      this.scheduleNext();
    }
  }

  updateAverageProcessTime(newDuration) {
    const count = this.metrics.totalCompleted;
    if (count === 1) {
      this.metrics.averageProcessTimeMs = newDuration;
    } else {
      this.metrics.averageProcessTimeMs = Math.round(
        (this.metrics.averageProcessTimeMs * (count - 1) + newDuration) / count
      );
    }
  }

  // --- CÁC HÀM QUẢN TRỊ DEAD-LETTER QUEUE (DLQ) ---
  getDeadLetterQueue() {
    return this.deadLetterQueue.map(j => this.serializeJob(j));
  }

  retryDeadLetterJob(jobId) {
    const idx = this.deadLetterQueue.findIndex(j => j.id === jobId);
    if (idx === -1) return null;

    const [job] = this.deadLetterQueue.splice(idx, 1);
    job.retries = 0;
    job.status = 'PENDING';
    job.error = null;
    job.movedToDlqAt = null;

    this.queue.push(job);
    this.scheduleNext();
    this.emit('JOB_RETRY_FROM_DLQ', job);

    return this.serializeJob(job);
  }

  clearDeadLetterQueue() {
    const count = this.deadLetterQueue.length;
    this.deadLetterQueue.length = 0;
    return count;
  }

  // --- HỖ TRỢ GRACEFUL SHUTDOWN ---
  async drainActiveWorkers(timeoutMs = 8000) {
    const start = Date.now();
    console.log(`[Queue Drain] Đang chờ ${this.activeWorkers} worker hoàn thành công việc...`);

    while (this.activeWorkers > 0) {
      if (Date.now() - start > timeoutMs) {
        console.warn(`[Queue Drain] Quá thời gian timeout (${timeoutMs}ms). Bắt buộc dừng.`);
        break;
      }
      await new Promise(r => setTimeout(r, 200));
    }
    console.log('[Queue Drain] Toàn bộ worker đã giải phóng an toàn.');
  }

  getStats() {
    return {
      queueLength: this.queue.length,
      activeWorkers: this.activeWorkers,
      concurrency: this.concurrency,
      deadLetterQueueLength: this.deadLetterQueue.length,
      metrics: this.metrics,
      recentJobs: this.jobHistory.map(j => this.serializeJob(j))
    };
  }
}

module.exports = new AsyncEmailQueue();
