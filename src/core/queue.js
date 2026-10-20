/**
 * Queue Engine: Hàng đợi xử lý bất đồng bộ để đạt SLA phản hồi < 45ms
 * Thành viên phụ trách: Thành viên 1
 */

const queue = [];
let isProcessing = false;

module.exports = {
  enqueue: (task) => {
    queue.push(task);
    processNext();
    return { queued: true, queueLength: queue.length };
  },
  getQueueLength: () => queue.length
};

async function processNext() {
  if (isProcessing || queue.length === 0) return;
  isProcessing = true;
  const task = queue.shift();

  try {
    if (typeof task.handler === 'function') {
      await task.handler();
    }
  } catch (err) {
    console.error('[Queue Error]', err.message);
  } finally {
    isProcessing = false;
    processNext();
  }
}
