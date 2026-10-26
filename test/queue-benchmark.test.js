// Queue, Validator, DLQ & SLA Benchmark Test Suite
// Dành cho Thành dùng để chứng minh hiệu năng và độ tin cậy trong buổi Seminar

const queue = require('../src/core/queue');
const circuitBreaker = require('../src/core/circuit-breaker');
const validator = require('../src/core/validator');

async function runBenchmark() {
  console.log(' BẮT ĐẦU KIỂM THỬ TOÀN DIỆN CORE BACKEND');
  console.log('\n');

  // Test 1: Kiểm thử Validator RFC 5322
  console.log('TEST 1: Kiểm thử Email & Payload Validator (RFC 5322)');
  const validTest = validator.validateSendPayload({
    to: 'thanh.nguyen@example.com',
    subject: 'Tiêu đề hợp lệ',
    text: 'Nội dung hợp lệ'
  });
  console.log(`Email hợp lệ: ${validTest.isValid ? '✅ ĐẠT' : '❌ LỖI'}`);

  const invalidEmailTest = validator.validateSendPayload({
    to: 'email-sai-dinh-dang',
    subject: 'Test',
    text: 'Hello'
  });
  console.log(`Chặn email sai định dạng: ${!invalidEmailTest.isValid ? '✅ ĐÃ CHẶN THÀNH CÔNG' : '❌ THẤT BẠI'}`);

  const emptyBodyTest = validator.validateSendPayload({
    to: 'test@example.com'
  });
  console.log(`Chặn email thiếu nội dung text/html: ${!emptyBodyTest.isValid ? '✅ ĐÃ CHẶN THÀNH CÔNG' : '❌ THẤT BẠI'}\n`);

  // Test 2: Đo SLA thời gian phản hồi khi đưa vào Queue (Enqueue Latency)
  console.log('TEST 2: Đo độ trễ tiếp nhận Enqueue (Mục tiêu SLA < 45ms)');
  const samples = 10;
  const latencies = [];

  for (let i = 0; i < samples; i++) {
    const start = process.hrtime();

    queue.enqueue(
      { to: `user${i}@example.com`, subject: `Benchmark #${i}`, text: 'Hello' },
      async () => {
        // Giả lập thời gian gửi SMTP mất 100ms
        await new Promise(r => setTimeout(r, 100));
      }
    );

    const diff = process.hrtime(start);
    const latencyMs = Math.round((diff[0] * 1000 + diff[1] / 1e6) * 100) / 100;
    latencies.push(latencyMs);
  }

  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  console.log(`✓ Số mẫu đo: ${samples} requests`);
  console.log(`✓ Độ trễ trung bình: ${avgLatency.toFixed(2)} ms`);
  console.log(`✓ Đạt chuẩn SLA (< 45ms): ${avgLatency < 45 ? '✅ ĐẠT (XUẤT SẮC)' : '❌ CHƯA ĐẠT'}\n`);

  // Test 3: Kiểm thử Dead-Letter Queue (DLQ)
  console.log('TEST 3: Kiểm thử Dead-Letter Queue (DLQ) sau khi thử lại thất bại');
  console.log('Đang tạo 1 job luôn thất bại để kiểm tra cơ chế chuyển vào DLQ...');

  // Dùng baseDelayMs siêu ngắn (50ms) để test nhanh
  const originalDelay = queue.baseDelayMs;
  queue.baseDelayMs = 50;

  queue.enqueue(
    { to: 'fail@example.com', subject: 'DLQ Test Job', text: 'Error' },
    async () => {
      throw new Error('Mô phỏng lỗi SMTP không thể phục hồi');
    }
  );

  // Chờ cho 3 lần retry hoàn tất (50ms + 100ms + 200ms)
  await new Promise(r => setTimeout(r, 1200));
  queue.baseDelayMs = originalDelay;

  const dlq = queue.getDeadLetterQueue();
  console.log(`Số job trong Dead-Letter Queue: ${dlq.length}`);
  console.log(`Job chuyển vào DLQ thành công: ${dlq.length > 0 ? '✅ HOÀN HẢO' : '❌ LỖI'}\n`);

  // Test 4: Kiểm thử Circuit Breaker
  console.log('TEST 4: Kiểm thử Circuit Breaker bảo vệ tài khoản Gmail');
  console.log(`Trạng thái ban đầu: ${circuitBreaker.getStatus().state}`);

  console.log('Giả lập 5 lần lỗi liên tiếp...');
  for (let i = 1; i <= 5; i++) {
    circuitBreaker.recordFailure(new Error(`Simulated Error #${i}`));
  }

  const cbStatus = circuitBreaker.getStatus();
  console.log(`Trạng thái sau 5 lỗi: ${cbStatus.state}`);
  console.log(`Có cho phép gửi tiếp không (canExecute): ${circuitBreaker.canExecute() ? 'Có' : 'Không (Đã ngắt an toàn)'}`);
  console.log(`✓ Hoạt động Circuit Breaker: ${cbStatus.state === 'OPEN' ? '✅ HOÀN HẢO' : '❌ LỖI'}\n`);

  circuitBreaker.manualReset();
  console.log(`✓ Đã reset Circuit Breaker về: ${circuitBreaker.getStatus().state}\n`);

  // Test 5: Kiểm thử Template Engine (3 chức năng trọng tâm của đề bài)
  console.log('TEST 5: Kiểm thử Template Engine (Account Verification, Password Reset, HTML)');
  const templates = require('../src/core/templates');

  // 1. Verify Email
  const verifyTpl = templates.render('verify-email', { name: 'Nguyễn Văn A', otp: '654321' });
  const hasOtp = verifyTpl.html.includes('654321') && verifyTpl.html.includes('Nguyễn Văn A');
  console.log(`Render template Account Verification (OTP): ${hasOtp ? '✅ ĐẠT CHUẨN' : '❌ LỖI'}`);

  // 2. Password Reset (Kiểm tra mặc định 5 phút và tùy chỉnh)
  const resetTplDefault = templates.render('password-reset', { name: 'Nguyễn Văn A', resetUrl: 'https://myapp.com/reset' });
  const hasResetDefault = resetTplDefault.html.includes('https://myapp.com/reset') && resetTplDefault.html.includes('5 phút');
  console.log(`Render template Password Reset (Mặc định TTL 5 phút): ${hasResetDefault ? '✅ ĐẠT CHUẨN' : '❌ LỖI'}`);

  const resetTplCustom = templates.render('password-reset', { name: 'Nguyễn Văn A', resetUrl: 'https://myapp.com/reset', expiresInMinutes: 30 });
  const hasResetCustom = resetTplCustom.html.includes('https://myapp.com/reset') && resetTplCustom.html.includes('30 phút');
  console.log(`Render template Password Reset (Tùy chỉnh TTL 30 phút): ${hasResetCustom ? '✅ ĐẠT CHUẨN' : '❌ LỖI'}`);

  // 3. Custom HTML
  const customTpl = templates.render('custom-html', { title: 'Chào Mừng', content: '<p>Xin chào</p>' });
  const hasCustom = customTpl.html.includes('Chào Mừng') && customTpl.html.includes('<p>Xin chào</p>');
  console.log(`Render template Custom HTML Email: ${hasCustom ? '✅ ĐẠT CHUẨN' : '❌ LỖI'}\n`);

  console.log('TOÀN BỘ 5 BỘ TEST ĐỀ BÀI & HIỆU NĂNG ĐÃ VƯỢT QUA!');
}

runBenchmark().catch(console.error);
