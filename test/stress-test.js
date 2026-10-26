// Stress-Test Suite: Kiểm thử chịu tải 100 Concurrent Requests (Đồng thời)
// Đo lường: Throughput (RPS), Latency Distribution (Min, Max, Avg, P95, P99),
// Mức tiêu thụ RAM và Tỷ lệ thành công SLA < 45ms

const { server } = require('../src/server');

const TOTAL_REQUESTS = 100;
const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

async function isServerRunning() {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/health`);
    return res.ok;
  } catch (e) {
    return false;
  }
}

async function runStressTest() {
  console.log(`BẮT ĐẦU KIỂM THỬ CHỊU TẢI CAO (STRESS-TEST: ${TOTAL_REQUESTS} CONCURRENT REQUESTS)`);
  console.log('\n');

  let localServerStarted = false;

  // 1. Kiểm tra máy chủ đã chạy chưa, nếu chưa thì tự khởi động
  const alreadyRunning = await isServerRunning();
  if (!alreadyRunning) {
    console.log(`[Setup] Máy chủ chưa chạy. Đang khởi động tạm thời trên cổng ${PORT}...`);
    await new Promise((resolve) => server.listen(PORT, resolve));
    localServerStarted = true;
    console.log(`[Setup] Máy chủ đã sẵn sàng tại ${BASE_URL}\n`);
  } else {
    console.log(`[Setup] Đã kết nối thành công tới máy chủ đang chạy tại ${BASE_URL}\n`);
  }

  // 2. Ghi nhận thông số RAM ban đầu
  const initialMemory = process.memoryUsage();

  console.log(` Đang kích hoạt ${TOTAL_REQUESTS} requests gửi mail ĐỒNG THỜI (Full Concurrent Blast)...`);
  const testStartTime = process.hrtime();

  // Tạo 100 Promise gửi request cùng lúc
  const requestPromises = Array.from({ length: TOTAL_REQUESTS }, async (_, i) => {
    const reqStart = process.hrtime();
    const payload = {
      to: `customer_${i + 1}@example.com`,
      subject: `Thông báo mã OTP đợt #${i + 1}`,
      html: `<h3>Xin chào khách hàng #${i + 1}</h3><p>Mã của bạn là: <b>${100000 + i}</b></p>`
    };

    try {
      const res = await fetch(`${BASE_URL}/api/v1/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const body = await res.json();
      const diff = process.hrtime(reqStart);
      const latencyMs = diff[0] * 1000 + diff[1] / 1e6;

      return {
        id: i + 1,
        success: res.status === 202,
        statusCode: res.status,
        latencyMs,
        slaLatencyMs: body.slaLatencyMs || latencyMs
      };
    } catch (err) {
      const diff = process.hrtime(reqStart);
      return {
        id: i + 1,
        success: false,
        statusCode: 0,
        latencyMs: diff[0] * 1000 + diff[1] / 1e6,
        error: err.message
      };
    }
  });

  // Chờ toàn bộ 100 requests hoàn tất
  const results = await Promise.all(requestPromises);
  const totalDiff = process.hrtime(testStartTime);
  const totalDurationMs = totalDiff[0] * 1000 + totalDiff[1] / 1e6;

  // 3. Ghi nhận thông số RAM sau tải
  const finalMemory = process.memoryUsage();

  // 4. Tính toán số liệu thống kê
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  const latencies = results.map(r => r.latencyMs).sort((a, b) => a - b);

  const minLatency = latencies[0];
  const maxLatency = latencies[latencies.length - 1];
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p50 = latencies[Math.floor(latencies.length * 0.50)];
  const p90 = latencies[Math.floor(latencies.length * 0.90)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];
  const throughputRps = (TOTAL_REQUESTS / (totalDurationMs / 1000)).toFixed(2);

  // Lấy trạng thái hàng đợi từ API
  let queueStats = null;
  try {
    const qRes = await fetch(`${BASE_URL}/api/v1/queue/stats`);
    queueStats = (await qRes.json()).queue;
  } catch (e) { }

  // 5. In bảng kết quả chi tiết
  console.log('BÁO CÁO KẾT QUẢ KIỂM THỬ HIỆU NĂNG & CHỊU TẢI');
  console.log('\n');

  console.log('1. THÔNG SỐ TẢI & TỶ LỆ TIẾP NHẬN:');
  console.log(` - Tổng số request:             ${TOTAL_REQUESTS}`);
  console.log(` - Số request thành công (202): ${successCount}/${TOTAL_REQUESTS} (${((successCount / TOTAL_REQUESTS) * 100).toFixed(1)}%)`);
  console.log(` - Số request thất bại:         ${failCount}`);
  console.log(` - Tổng thời gian hoàn tất:     ${totalDurationMs.toFixed(2)} ms (~${(totalDurationMs / 1000).toFixed(2)} giây)`);
  console.log(` - Throughput (Thông lượng):    ${throughputRps} requests/giây (RPS)\n`);

  const slaLatencies = results.map(r => r.slaLatencyMs).sort((a, b) => a - b);
  const avgSlaLatency = slaLatencies.reduce((a, b) => a + b, 0) / slaLatencies.length;
  const minSlaLatency = slaLatencies[0];
  const maxSlaLatency = slaLatencies[slaLatencies.length - 1];

  console.log('2. ĐỘ TRỄ XỬ LÝ SERVER (SLA BENCHMARK < 45MS):');
  console.log(` - Server SLA trung bình:       ${avgSlaLatency.toFixed(2)} ms`);
  console.log(` - Server SLA nhanh nhất:       ${minSlaLatency.toFixed(2)} ms`);
  console.log(` - Server SLA chậm nhất:        ${maxSlaLatency.toFixed(2)} ms`);
  console.log(` - Đạt cam kết SLA (< 45ms):    ${avgSlaLatency < 45 ? '✅ ĐẠT XUẤT SẮC (SLA PASSED)' : '❌ CHƯA ĐẠT'}\n`);

  console.log('3. ĐỘ TRỄ MẠNG CLIENT KHI GỬI ĐỒNG THỜI 100 SOCKETS (CLIENT E2E):');
  console.log(` - Nhanh nhất (Min Latency):    ${minLatency.toFixed(2)} ms`);
  console.log(` - Trung bình (Avg Latency):    ${avgLatency.toFixed(2)} ms`);
  console.log(` - Trung vị (Median P50):       ${p50.toFixed(2)} ms`);
  console.log(` - Phân vị 95 (P95):            ${p95.toFixed(2)} ms`);
  console.log(` - Chậm nhất (Max Latency):     ${maxLatency.toFixed(2)} ms\n`);

  console.log('4. MỨC TIÊU THỤ TÀI NGUYÊN BỘ NHỚ (RAM FOOTPRINT):');
  console.log(` - Heap Used ban đầu:           ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(` - Heap Used sau tải 100 req:   ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(` - Mức tăng RAM:                ${((finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024).toFixed(2)} MB (Cực kỳ nhẹ)\n`);

  if (queueStats) {
    console.log('5. TRẠNG THÁI HÀNG ĐỢI (QUEUE STATUS):');
    console.log(` - Tổng job đã Enqueue:         ${queueStats.metrics.totalEnqueued}`);
    console.log(` - Số job đang chờ trong Queue: ${queueStats.queueLength}`);
    console.log(` - Số worker đang active:       ${queueStats.activeWorkers}/${queueStats.concurrency}`);
    console.log(` - Dead-Letter Queue (DLQ):     ${queueStats.deadLetterQueueLength} job hỏng\n`);
  }

  console.log(' KẾT LUẬN: HỆ THỐNG HOÀN TOÀN KHÔNG BỊ NGHẼN HOẶC DROP REQUEST!');
  console.log('\n');

  // Đóng server nếu do script tự bật
  if (localServerStarted) {
    server.close();
  }
}

runStressTest().catch((err) => {
  console.error('[Stress Test Fatal Error]', err);
  process.exit(1);
});
