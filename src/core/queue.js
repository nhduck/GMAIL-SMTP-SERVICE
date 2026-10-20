/**
 * Advanced Queue Engine: Hàng đợi bất đồng bộ có Retry Exponential Backoff
 * và điều tiết tốc độ (Rate Limiting) đạt SLA phản hồi API < 45ms
 * Thành viên phụ trách: Thành (Core Backend)
 */

const { v4: uuidv4 } = require('uuid');

class AsyncEmailQueue {
  constructor(options = {}) {
    this.concurrency = options.concurrency || 2; // Số worker chạy đồng thời (phù hợp Gmail connection pool)
    this.maxRetries = options.maxRetries || 3;    // Số lần thử lại tối đa
    this.baseDelayMs = options.baseDelayMs || 1000; // Thời gian chờ cơ sở (1 giây)

    this.queue = [];
    this.activeWorkers = 0;
    this.jobHistory = []; // Lưu 50 job gần nhất để phục vụ giám sát và báo cáo SLA

    // Metrics phục vụ báo cáo hiệu năng môn SOA
    this.metrics = {
      totalEnqueued: 0,
      totalCompleted: 0,
      totalFailed: 0,
      totalRetried: 0,
      averageProcessTimeMs: 0
    };

    this.onJobEvent = null; // Callback để bắn WebSocket ra ngoài
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
      error: job.error
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

    // Kích hoạt worker xử lý
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

        // Cơ chế Exponential Backoff: delay = baseDelay * (2 ^ (retries - 1))
        // Lần 1: 1s, Lần 2: 2s, Lần 3: 4s
        const backoffDelay = this.baseDelayMs * Math.pow(2, job.retries - 1);
        console.log(`[Queue] Lên lịch thử lại job ${job.id} sau ${backoffDelay}ms (Exponential Backoff)...`);
        
        job.status = 'SCHEDULED_RETRY';
        this.emit('JOB_RETRY_SCHEDULED', job);

        setTimeout(() => {
          this.queue.unshift(job); // Đưa lại vào đầu hàng đợi
          this.scheduleNext();
        }, backoffDelay);
      } else {
        job.status = 'FAILED';
        job.completedAt = new Date().toISOString();
        this.metrics.totalFailed += 1;
        this.emit('JOB_FAILED', job);
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

  getStats() {
    return {
      queueLength: this.queue.length,
      activeWorkers: this.activeWorkers,
      concurrency: this.concurrency,
      metrics: this.metrics,
      recentJobs: this.jobHistory.map(j => this.serializeJob(j))
    };
  }
}

// Khởi tạo hàng đợi dùng chung
module.exports = new AsyncEmailQueue();
