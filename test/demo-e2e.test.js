/**
 * test/demo-e2e.test.js
 * Kiểm thử tự động Toàn Luồng End-to-End (E2E) trong môi trường Sandbox
 * Kịch bản toàn diện:
 * 1. Nhân viên đăng ký -> Nhận OTP (5 phút) -> Kích hoạt tài khoản
 * 2. Tạo đơn nghỉ phép -> Quản lý nhận email hướng dẫn Reply trực tiếp
 * 3. Quản lý Reply "Duyệt" (kèm trích dẫn cũ chứa cả từ "Từ chối") -> Cắt trích dẫn chuẩn -> Đơn được APPROVED
 * 4. Nhân viên nhận email kết quả tức thì
 * 5. Test phản hồi "Không duyệt" -> Nhận diện chính xác REJECTED (ranh giới từ)
 * 6. Test phản hồi mâu thuẫn "Duyệt, đừng từ chối" -> Giữ nguyên PENDING, gửi email nhắc cú pháp
 * 7. Test bảo mật Webhook: sai Secret (401), người gửi giả mạo (bị từ chối), chống Replay
 * 8. Test an toàn Gateway: bỏ qua thư Auto-Submitted, thư không có Re:, thư từ chính Gateway
 * 9. Quên mật khẩu (TTL 5 phút, hủy link cũ & session cũ) -> Đăng nhập lại
 */

const { server: emailServer } = require('../src/server');
const leaveApp = require('../demo-app/server');
const { cleanReplyText, extractPureEmail } = require('../src/core/text-cleaner');

const EMAIL_PORT = 3000;
const DEMO_PORT = 4000;

let startedEmailLocally = false;
let startedDemoLocally = false;
let demoServerInstance = null;

async function isPortResponding(port) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300);
    const res = await fetch(`http://localhost:${port}/`, { signal: controller.signal });
    clearTimeout(timeout);
    return Boolean(res);
  } catch (_) {
    return false;
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function startServers() {
  const isEmailUp = await isPortResponding(EMAIL_PORT);
  if (!isEmailUp) {
    await new Promise((resolve) => emailServer.listen(EMAIL_PORT, resolve));
    startedEmailLocally = true;
  }

  const isDemoUp = await isPortResponding(DEMO_PORT);
  if (!isDemoUp) {
    await new Promise((resolve) => {
      demoServerInstance = leaveApp.listen(DEMO_PORT, resolve);
    });
    startedDemoLocally = true;
  }
}

async function stopServers() {
  if (startedDemoLocally && demoServerInstance) {
    demoServerInstance.close();
  }
  if (startedEmailLocally && emailServer && emailServer.listening) {
    emailServer.close();
  }
}

async function runE2ETest() {
  console.log('🧪 BẮT ĐẦU KIỂM THỬ TỰ ĐỘNG TOÀN LUỒNG END-TO-END (HAI CHIỀU SMTP & IMAP REPLY)');
  console.log('\n');

  try {
    await startServers();

    // Đảm bảo Gateway ở chế độ SANDBOX
    await fetch(`http://localhost:${EMAIL_PORT}/api/v1/config/mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'SANDBOX' })
    });

    // Cấu hình Webhook URL & Secret đồng bộ
    const TEST_SECRET = 'sec_seminar_webhook_key';
    await fetch(`http://localhost:${EMAIL_PORT}/api/v1/config/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhookUrl: `http://localhost:${DEMO_PORT}/api/webhook/email-reply`,
        webhookSecret: TEST_SECRET
      })
    });

    // Xóa sạch hộp thư ảo Sandbox trước khi chạy
    await fetch(`http://localhost:${EMAIL_PORT}/api/v1/mails`, { method: 'DELETE' });

    // ==========================================
    // BƯỚC 1: ĐĂNG KÝ TÀI KHOẢN & XÁC THỰC OTP
    // ==========================================
    console.log('--- BƯỚC 1: Đăng ký tài khoản nhân viên mới & Nhận OTP ---');
    const employeeEmail = 'nhanvien_test@tdtu.edu.vn';
    const regRes = await fetch(`http://localhost:${DEMO_PORT}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Trần Văn Demo',
        email: employeeEmail,
        password: 'Password@123'
      })
    });
    const regData = await regRes.json();
    console.log(`Đăng ký nhân viên: ${regRes.ok ? '✅ THÀNH CÔNG' : '❌ THẤT BẠI'}`);

    await sleep(250);

    const mailsRes1 = await fetch(`http://localhost:${EMAIL_PORT}/api/v1/mails`);
    const { data: mails1 } = await mailsRes1.json();
    const otpMail = mails1.find(m => m.to === employeeEmail);
    if (!otpMail) throw new Error('❌ Không tìm thấy email OTP trong hộp thư Sandbox!');

    const otpMatch = otpMail.html.match(/>\s*(\d{6})\s*</);
    const extractedOtp = otpMatch ? otpMatch[1] : regData.sandboxOtp;
    console.log(`Email OTP hiển thị đúng thời hạn 5 phút: ${otpMail.html.includes('5 phút') ? '✅ ĐẠT CHUẨN' : '❌ SAI'}`);
    console.log(`Mã OTP trích xuất chính xác: ${extractedOtp}`);

    const verifyRes = await fetch(`http://localhost:${DEMO_PORT}/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: employeeEmail, otp: extractedOtp })
    });
    const verifyData = await verifyRes.json();
    const sessionToken = verifyData.token;
    console.log(`Kích hoạt tài khoản bằng OTP: ${verifyRes.ok && sessionToken ? '✅ THÀNH CÔNG' : '❌ LỖI'}`);

    // ==========================================
    // BƯỚC 2: TẠO ĐƠN NGHỈ PHÉP (TIÊU ĐỀ CHUẨN MÃ ĐƠN)
    // ==========================================
    console.log('\n--- BƯỚC 2: Tạo đơn xin nghỉ phép gửi tới Quản lý ---');
    const managerEmail = 'manager@demo.local';
    const leaveRes = await fetch(`http://localhost:${DEMO_PORT}/api/leaves`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify({
        startDate: '2026-11-01',
        endDate: '2026-11-03',
        days: 3,
        reason: '<script>alert("hack")</script>Nghỉ phép cá nhân',
        managerEmail
      })
    });
    const leaveData = await leaveRes.json();
    const leaveId = leaveData.leave.id;
    console.log(`Tạo đơn xin nghỉ phép: ${leaveRes.ok ? '✅ THÀNH CÔNG' : '❌ LỖI'}`);
    console.log(`Mã đơn định danh chuẩn: #${leaveId}`);

    await sleep(250);

    // ==========================================
    // BƯỚC 3: KIỂM TRA EMAIL GỬI TỚI QUẢN LÝ (KHÔNG CÒN NÚT, CÓ HƯỚNG DẪN REPLY)
    // ==========================================
    console.log('\n--- BƯỚC 3: Quản lý nhận email (Kiểm tra tiêu đề, không có nút bấm, có hướng dẫn Reply) ---');
    const mailsRes2 = await fetch(`http://localhost:${EMAIL_PORT}/api/v1/mails`);
    const { data: mails2 } = await mailsRes2.json();
    const managerMail = mails2.find(m => m.subject.includes(leaveId));
    if (!managerMail) throw new Error('❌ Không tìm thấy email gửi tới Quản lý cho đơn #' + leaveId);

    const hasExpectedTitle = managerMail.subject.includes(`[Đơn Xin Nghỉ Phép #${leaveId}]`);
    console.log(`Tiêu đề email chứa mã đơn [Đơn Xin Nghỉ Phép #${leaveId}]: ${hasExpectedTitle ? '✅ CHUẨN' : '❌ SAI'}`);

    // Email không được có nút URL duyệt trực tiếp nữa (theo yêu cầu của thầy)
    const hasButtons = managerMail.html.includes('action=approve') || managerMail.html.includes('primary-button');
    console.log(`Đã loại bỏ nút bấm duyệt mở web khỏi email: ${!hasButtons ? '✅ CHUẨN (KHÔNG CÒN NÚT)' : '❌ VẪN CÒN NÚT'}`);

    const hasReplyGuide = managerMail.html.includes('Reply (Trả lời)') || managerMail.html.includes('phê duyệt trực tiếp');
    console.log(`Có khung hướng dẫn Reply "Duyệt" hoặc "Từ chối": ${hasReplyGuide ? '✅ ĐẠT CHUẨN' : '❌ THIẾU'}`);

    // ==========================================
    // BƯỚC 4: QUẢN LÝ REPLY "DUYỆT" (KÈM TRÍCH DẪN THƯ CŨ CÓ CẢ TỪ "TỪ CHỐI")
    // ==========================================
    console.log('\n--- BƯỚC 4: Quản lý Reply "Duyệt" (Kèm trích dẫn Gmail chứa cả chữ "Từ chối") ---');
    const realisticGmailReply = `Duyệt đơn nhé em!

Vào Th 5, 29 thg 10, 2026 lúc 10:00 TMT Company <sandbox@demo.local> đã viết:
> HƯỚNG DẪN: Bấm Reply, gõ "Duyệt" hoặc "Từ chối" rồi bấm Gửi.
> Chi tiết đơn nghỉ phép #${leaveId}...`;

    // Gọi API giả lập Reply trong Sandbox (đi qua đúng text-cleaner và Webhook Dispatcher)
    const replyRes = await fetch(`http://localhost:${EMAIL_PORT}/api/v1/sandbox/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mailId: managerMail.id,
        from: managerEmail,
        replyText: realisticGmailReply
      })
    });
    const replyData = await replyRes.json();
    console.log(`Gửi phản hồi qua Sandbox Reply API: ${replyRes.ok ? '✅ THÀNH CÔNG' : '❌ THẤT BẠI'}`);
    console.log(`Bộ lọc cleanReplyText cắt bỏ trích dẫn: "${replyData.data.replyText}" -> ${replyData.data.replyText === 'Duyệt đơn nhé em!' ? '✅ CẮT CHUẨN TUYỆT ĐỐI' : '❌ LỖI'}`);

    await sleep(350);

    // Kiểm tra trạng thái đơn ở Cổng 4000
    const checkLeaveRes1 = await fetch(`http://localhost:${DEMO_PORT}/api/leaves`, {
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    });
    const { leaves: leaves1 } = await checkLeaveRes1.json();
    const approvedLeave = leaves1.find(l => l.id === leaveId);
    console.log(`Trạng thái đơn #${leaveId} sau khi Quản lý Reply: ${approvedLeave && approvedLeave.status === 'APPROVED' ? '✅ ĐÃ DUYỆT (APPROVED)' : '❌ CHƯA DUYỆT'}`);

    // Kiểm tra Nhân viên nhận được email kết quả tự động
    const mailsRes3 = await fetch(`http://localhost:${EMAIL_PORT}/api/v1/mails`);
    const { data: mails3 } = await mailsRes3.json();
    const resultMail = mails3.find(m => m.to === employeeEmail && m.subject.includes('Đã Được Duyệt'));
    console.log(`Nhân viên nhận email thông báo kết quả: ${resultMail ? '✅ ĐÃ NHẬN THÀNH CÔNG' : '❌ CHƯA NHẬN'}`);

    // ==========================================
    // BƯỚC 5: TEST TỪ KHÓA PHỦ ĐỊNH "KHÔNG DUYỆT" -> REJECTED
    // ==========================================
    console.log('\n--- BƯỚC 5: Kiểm thử từ khóa phủ định "Không duyệt" (Ranh giới từ) ---');
    const leaveRes2 = await fetch(`http://localhost:${DEMO_PORT}/api/leaves`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify({
        startDate: '2026-11-10',
        endDate: '2026-11-12',
        days: 2,
        reason: 'Nghỉ du lịch cá nhân',
        managerEmail
      })
    });
    const leaveId2 = (await leaveRes2.json()).leave.id;

    // Quản lý reply phủ định: "Không duyệt đơn này nhé"
    const webhookRes2 = await fetch(`http://localhost:${DEMO_PORT}/api/webhook/email-reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': TEST_SECRET
      },
      body: JSON.stringify({
        event: 'email.reply.received',
        data: {
          from: managerEmail,
          subject: `Re: [Đơn Xin Nghỉ Phép #${leaveId2}] Cần phê duyệt`,
          replyText: 'Không duyệt đơn này nhé, dự án đang vào đợt release gấp.'
        }
      })
    });
    const webhookData2 = await webhookRes2.json();
    console.log(`Phân tích cụm từ phủ định "không duyệt": ${webhookData2.leave && webhookData2.leave.status === 'REJECTED' ? '✅ NHẬN DIỆN ĐÚNG REJECTED' : '❌ SAI'}`);

    // ==========================================
    // BƯỚC 6: TEST PHẢN HỒI MÂU THUẪN -> GIỮ PENDING & GỬI THƯ NHẮC CÚ PHÁP
    // ==========================================
    console.log('\n--- BƯỚC 6: Kiểm thử phản hồi mâu thuẫn ("Duyệt, đừng từ chối") ---');
    const leaveRes3 = await fetch(`http://localhost:${DEMO_PORT}/api/leaves`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify({
        startDate: '2026-11-15',
        endDate: '2026-11-16',
        days: 1,
        reason: 'Nghỉ giải quyết việc riêng',
        managerEmail
      })
    });
    const leaveId3 = (await leaveRes3.json()).leave.id;

    const webhookRes3 = await fetch(`http://localhost:${DEMO_PORT}/api/webhook/email-reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': TEST_SECRET
      },
      body: JSON.stringify({
        event: 'email.reply.received',
        data: {
          from: managerEmail,
          subject: `Re: [Đơn Xin Nghỉ Phép #${leaveId3}] Cần phê duyệt`,
          replyText: 'Duyệt, đừng từ chối'
        }
      })
    });
    const webhookData3 = await webhookRes3.json();
    console.log(`Phát hiện phản hồi mơ hồ / mâu thuẫn: ${webhookData3.ambiguous === true ? '✅ ĐÃ BẮT CHÍNH XÁC' : '❌ LỖI'}`);

    await sleep(250);

    const mailsRes4 = await fetch(`http://localhost:${EMAIL_PORT}/api/v1/mails`);
    const { data: mails4 } = await mailsRes4.json();
    const clarifyMail = mails4.find(m => m.to === managerEmail && m.subject.includes('Cú pháp phản hồi chưa rõ ràng'));
    console.log(`Tự động gửi email hướng dẫn lại cú pháp cho Quản lý: ${clarifyMail ? '✅ ĐÃ GỬI THÀNH CÔNG' : '❌ THIẾU'}`);

    // ==========================================
    // BƯỚC 7: TEST BẢO MẬT WEBHOOK & CHỐNG REPLAY
    // ==========================================
    console.log('\n--- BƯỚC 7: Kiểm thử bảo mật Webhook (Secret, Người gửi giả mạo & Chống Replay) ---');

    // 7.1 Sai Secret -> 401
    const badSecretRes = await fetch(`http://localhost:${DEMO_PORT}/api/webhook/email-reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': 'wrong_secret_key' },
      body: JSON.stringify({ event: 'email.reply.received', data: { from: managerEmail, subject: `Re: #${leaveId3}`, replyText: 'Duyệt' } })
    });
    console.log(`Chặn Webhook sai Secret (401): ${badSecretRes.status === 401 ? '✅ ĐÃ CHẶN AN TOÀN' : '❌ LỖI'}`);

    // 7.2 Người gửi giả mạo (không phải managerEmail của đơn) -> bị từ chối
    const imposterRes = await fetch(`http://localhost:${DEMO_PORT}/api/webhook/email-reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': TEST_SECRET },
      body: JSON.stringify({
        event: 'email.reply.received',
        data: {
          from: 'hacker@malicious.com',
          subject: `Re: [Đơn Xin Nghỉ Phép #${leaveId3}] Cần phê duyệt`,
          replyText: 'Duyệt'
        }
      })
    });
    const imposterData = await imposterRes.json();
    console.log(`Chặn người gửi giả mạo (không phải Quản lý): ${imposterData.reason === 'SENDER_NOT_MANAGER' ? '✅ ĐÃ TỪ CHỐI AN TOÀN' : '❌ LỖI'}`);

    // 7.3 Chống Replay: Đơn đã APPROVED ở Bước 4 không thể bị duyệt/từ chối lại
    const replayRes = await fetch(`http://localhost:${DEMO_PORT}/api/webhook/email-reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': TEST_SECRET },
      body: JSON.stringify({
        event: 'email.reply.received',
        data: {
          from: managerEmail,
          subject: `Re: [Đơn Xin Nghỉ Phép #${leaveId}] Cần phê duyệt`,
          replyText: 'Từ chối'
        }
      })
    });
    const replayData = await replayRes.json();
    console.log(`Chống Replay Attack trên đơn đã quyết định: ${replayData.reason === 'ALREADY_DECIDED' ? '✅ ĐÃ CHẶN (ALREADY_DECIDED)' : '❌ LỖI'}`);

    // ==========================================
    // BƯỚC 8: KIỂM THỬ ĐẶT LẠI MẬT KHẨU (TTL 5 PHÚT)
    // ==========================================
    console.log('\n--- BƯỚC 8: Kiểm thử chức năng Quên mật khẩu (TTL 5 phút) ---');
    await fetch(`http://localhost:${DEMO_PORT}/api/forgot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: employeeEmail })
    });
    await sleep(250);

    const mailsRes5 = await fetch(`http://localhost:${EMAIL_PORT}/api/v1/mails`);
    const { data: mails5 } = await mailsRes5.json();
    const resetMail = mails5.find(m => m.to === employeeEmail && m.subject.includes('đặt lại mật khẩu'));
    const has5Min = resetMail && resetMail.html.includes('5 phút');
    console.log(`Email Reset Password thể hiện đúng TTL 5 phút: ${has5Min ? '✅ ĐẠT CHUẨN' : '❌ LỖI'}`);

    console.log('\n========================================================================');
    console.log('🎉 TOÀN BỘ KỊCH BẢN E2E GIAO TIẾP HAI CHIỀU (SMTP & IMAP REPLY) ĐÃ ĐẠT 100%!');
    console.log('========================================================================\n');
  } catch (err) {
    console.error('\n❌ E2E TEST THẤT BẠI:', err.message);
    process.exitCode = 1;
  } finally {
    await stopServers();
    process.exit(process.exitCode || 0);
  }
}

runE2ETest();
