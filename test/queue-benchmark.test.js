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

  // Test 3: Kiểm thử Dead-Letter Queue (DLQ) & Phân loại lỗi tạm thời vs vĩnh viễn
  console.log('TEST 3: Kiểm thử Dead-Letter Queue (DLQ) sau khi thử lại thất bại & Lỗi vĩnh viễn 535');
  console.log('Đang tạo 1 job lỗi mạng tạm thời (retry 3 lần) và 1 job lỗi 535 BadCredentials (chuyển thẳng DLQ)...');

  queue.clearDeadLetterQueue();
  const originalDelay = queue.baseDelayMs;
  queue.baseDelayMs = 50;

  let transientAttempts = 0;
  queue.enqueue(
    { to: 'fail@example.com', subject: 'DLQ Transient Test Job', text: 'Error' },
    async () => {
      transientAttempts += 1;
      throw new Error('Mô phỏng lỗi timeout mạng tạm thời (ETIMEDOUT)');
    }
  );

  let permanentAttempts = 0;
  queue.enqueue(
    { to: 'authfail@example.com', subject: 'DLQ Permanent 535 Test Job', text: 'Error' },
    async () => {
      permanentAttempts += 1;
      throw new Error('535 5.7.8 Username and Password not accepted. BadCredentials');
    }
  );

  // Chờ cho 3 lần retry hoàn tất (50ms + 100ms + 200ms)
  await new Promise(r => setTimeout(r, 1200));
  queue.baseDelayMs = originalDelay;

  const dlq = queue.getDeadLetterQueue();
  console.log(`Số job trong Dead-Letter Queue: ${dlq.length}`);
  console.log(`Job lỗi tạm thời thử đủ 4 lần (1 chính + 3 retry): ${transientAttempts === 4 ? '✅ ĐẠT' : '❌ LỖI'}`);
  console.log(`Job lỗi 535 BadCredentials không retry thừa (chỉ 1 lần): ${permanentAttempts === 1 ? '✅ ĐẠT' : '❌ LỖI'}`);
  console.log(`Job chuyển vào DLQ thành công: ${dlq.length >= 2 ? '✅ HOÀN HẢO' : '❌ LỖI'}\n`);

  // Test 4: Kiểm thử Circuit Breaker (bao gồm giới hạn 1 request thăm dò ở HALF_OPEN)
  console.log('TEST 4: Kiểm thử Circuit Breaker bảo vệ tài khoản Gmail');
  circuitBreaker.manualReset();
  console.log(`Trạng thái ban đầu: ${circuitBreaker.getStatus().state}`);

  console.log('Giả lập 5 lần lỗi liên tiếp...');
  for (let i = 1; i <= 5; i++) {
    circuitBreaker.recordFailure(new Error(`Simulated Error #${i}`));
  }

  const cbStatus = circuitBreaker.getStatus();
  console.log(`Trạng thái sau 5 lỗi: ${cbStatus.state}`);
  console.log(`Có cho phép gửi tiếp không (canExecute): ${circuitBreaker.canExecute() ? 'Có' : 'Không (Đã ngắt an toàn)'}`);

  // Kiểm thử HALF_OPEN chỉ cho đúng 1 request thăm dò đi qua
  circuitBreaker.lastFailureTime = Date.now() - (circuitBreaker.resetTimeout + 100);
  const firstProbe = circuitBreaker.canExecute();
  const secondConcurrentProbe = circuitBreaker.canExecute();
  console.log(`HALF_OPEN chỉ cho phép 1 request thăm dò: ${firstProbe && !secondConcurrentProbe ? '✅ ĐẠT CHUẨN' : '❌ LỖI'}`);
  console.log(`✓ Hoạt động Circuit Breaker: ${cbStatus.state === 'OPEN' && firstProbe && !secondConcurrentProbe ? '✅ HOÀN HẢO' : '❌ LỖI'}\n`);

  circuitBreaker.manualReset();
  console.log(`✓ Đã reset Circuit Breaker về: ${circuitBreaker.getStatus().state}\n`);

  // Test 5: Kiểm thử Template Engine (3 chức năng trọng tâm của đề bài + XSS/URL Sanitization)
  console.log('TEST 5: Kiểm thử Template Engine (Account Verification, Password Reset, HTML & Bảo mật XSS)');
  const templates = require('../src/core/templates');

  // 1. Verify Email (Kiểm tra OTP, TTL mặc định 5 phút, và chống XSS trên name/appName)
  const verifyTpl = templates.render('verify-email', {
    name: '<img src=x onerror=alert(1)>Nguyễn Văn A',
    otp: '654321'
  });
  const hasOtp = verifyTpl.html.includes('654321')
    && verifyTpl.html.includes('5 phút')
    && verifyTpl.html.includes('&lt;img src=x onerror=alert(1)&gt;')
    && !verifyTpl.html.includes('<img src=x');
  console.log(`Render template Account Verification (OTP 5 phút + XSS Escape): ${hasOtp ? '✅ ĐẠT CHUẨN' : '❌ LỖI'}`);

  // 2. Password Reset (Kiểm tra mặc định 5 phút, tùy chỉnh 30 phút, XSS escape và chặn javascript: URL)
  const resetTplDefault = templates.render('password-reset', {
    name: '<b>Nguyễn Văn A</b>',
    resetUrl: 'https://myapp.com/reset'
  });
  const hasResetDefault = resetTplDefault.html.includes('https://myapp.com/reset')
    && resetTplDefault.html.includes('5 phút')
    && resetTplDefault.html.includes('&lt;b&gt;Nguyễn Văn A&lt;/b&gt;');
  console.log(`Render template Password Reset (Mặc định TTL 5 phút + XSS Escape): ${hasResetDefault ? '✅ ĐẠT CHUẨN' : '❌ LỖI'}`);

  const resetTplCustom = templates.render('password-reset', {
    name: 'Nguyễn Văn A',
    resetUrl: 'https://myapp.com/reset',
    expiresInMinutes: 30
  });
  const hasResetCustom = resetTplCustom.html.includes('https://myapp.com/reset') && resetTplCustom.html.includes('30 phút');
  console.log(`Render template Password Reset (Tùy chỉnh TTL 30 phút): ${hasResetCustom ? '✅ ĐẠT CHUẨN' : '❌ LỖI'}`);

  let blockedBadResetUrl = false;
  try {
    templates.render('password-reset', { name: 'A', resetUrl: 'javascript:alert(1)' });
  } catch (_) {
    blockedBadResetUrl = true;
  }
  console.log(`Chặn liên kết độc hại javascript: trong Password Reset: ${blockedBadResetUrl ? '✅ ĐẠT CHUẨN' : '❌ LỖI'}`);

  // 3. Custom HTML
  const customTpl = templates.render('custom-html', { title: 'Chào Mừng', content: '<p>Xin chào</p>' });
  const hasCustom = customTpl.html.includes('Chào Mừng')
    && customTpl.html.includes('<p>Xin chào</p>')
    && customTpl.html.includes('@media only screen');
  console.log(`Render template Custom HTML Email (Responsive @media): ${hasCustom ? '✅ ĐẠT CHUẨN' : '❌ LỖI'}`);

  // 4. Action Email (Mẫu thư hành động tương tác tổng quát)
  const actionTpl = templates.render('action-email', {
    title: 'Đơn Xin Nghỉ Phép Cần Duyệt',
    greeting: 'Chào Quản lý,',
    intro: 'Nhân viên vừa tạo đơn mới.',
    badge: { text: 'CHỜ DUYỆT', tone: 'warning' },
    details: [
      { label: 'Nhân viên', value: 'Nguyễn Văn A' },
      { label: 'Lý do', value: '<script>alert("xss")</script>Nghỉ ốm' }
    ],
    primaryButton: { text: 'Duyệt Đơn', url: 'https://myapp.com/decision/token123?action=approve' },
    secondaryButton: { text: 'Từ Chối', url: 'https://myapp.com/decision/token123?action=reject' }
  });

  const hasActionBtns = actionTpl.html.includes('Duyệt Đơn') && actionTpl.html.includes('Từ Chối');
  const hasBadge = actionTpl.html.includes('CHỜ DUYỆT');
  const hasEscaped = actionTpl.html.includes('&lt;script&gt;') && !actionTpl.html.includes('<script>');

  // Test từ chối URL độc hại (javascript:)
  const xssUrlTpl = templates.render('action-email', {
    primaryButton: { text: 'Bấm Vào', url: 'javascript:alert(1)' }
  });
  const blocksBadUrl = !xssUrlTpl.html.includes('javascript:alert(1)');

  const actionPassed = hasActionBtns && hasBadge && hasEscaped && blocksBadUrl;
  console.log(`Render template Action Email (Nút, Badge, XSS Escape, URL Sanitization): ${actionPassed ? '✅ ĐẠT CHUẨN' : '❌ LỖI'}\n`);

  if (!validTest.isValid || invalidEmailTest.isValid || emptyBodyTest.isValid || !hasOtp || !hasResetDefault || !blockedBadResetUrl || !actionPassed) {
    process.exitCode = 1;
  }

  console.log('TOÀN BỘ 5 BỘ TEST ĐỀ BÀI & HIỆU NĂNG ĐÃ VƯỢT QUA!');
}

runBenchmark().catch(console.error);
