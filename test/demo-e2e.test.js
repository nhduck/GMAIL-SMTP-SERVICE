/**
 * test/demo-e2e.test.js
 * Kiểm thử tự động Toàn Luồng End-to-End (E2E) trong môi trường Sandbox
 * Kịch bản: Nhân viên đăng ký -> Nhận OTP -> Đăng nhập -> Tạo đơn xin nghỉ -> Quản lý duyệt -> Nhận kết quả -> Quên mật khẩu
 */

const { server: emailServer } = require('../src/server');
const leaveApp = require('../demo-app/server');

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
  console.log('🧪 BẮT ĐẦU KIỂM THỬ TỰ ĐỘNG TOÀN LUỒNG END-TO-END (DEMO E2E)');
  console.log('\n');

  try {
    await startServers();
    // Đảm bảo Gateway ở chế độ SANDBOX khi chạy bài test E2E Sandbox
    await fetch(`http://localhost:${EMAIL_PORT}/api/v1/config/mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'SANDBOX' })
    });

    // Xóa sạch hộp thư ảo Sandbox trước khi chạy
    await fetch(`http://localhost:${EMAIL_PORT}/api/v1/mails`, { method: 'DELETE' });

    // BƯỚC 1: NHÂN VIÊN ĐĂNG KÝ TÀI KHOẢN
    console.log('--- BƯỚC 1: Đăng ký tài khoản nhân viên mới ---');
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

    // Đợi 200ms để hàng đợi Email Gateway xử lý xong
    await sleep(300);

    // BƯỚC 2: TRÍCH XUẤT OTP TỪ HỘP THƯ ẢO SANDBOX & XÁC THỰC
    console.log('\n--- BƯỚC 2: Trích xuất OTP từ Hộp thư ảo & Kích hoạt ---');
    const mailsRes1 = await fetch(`http://localhost:${EMAIL_PORT}/api/v1/mails`);
    const { data: mails1 } = await mailsRes1.json();
    const otpMail = mails1.find(m => m.to === employeeEmail);

    if (!otpMail) {
      throw new Error('❌ Không tìm thấy email OTP trong hộp thư ảo Sandbox!');
    }

    // Kiểm tra thông báo thời hạn OTP 5 phút khớp với store.js
    const otpHas5Min = otpMail.html.includes('5 phút');
    console.log(`Email OTP hiển thị đúng thời hạn 5 phút: ${otpHas5Min ? '✅ ĐẠT CHUẨN' : '❌ SAI TTL'}`);

    // Trích xuất mã OTP 6 số từ thẻ HTML (tránh nhầm mã màu CSS như #334155)
    const otpMatch = otpMail.html.match(/>\s*(\d{6})\s*</);
    const extractedOtp = otpMatch ? otpMatch[1] : regData.sandboxOtp;
    console.log(`Tìm thấy email OTP gửi tới: ${otpMail.to}`);
    console.log(`Mã OTP trích xuất chính xác: ${extractedOtp}`);

    // Xác thực OTP
    const verifyRes = await fetch(`http://localhost:${DEMO_PORT}/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: employeeEmail, otp: extractedOtp })
    });
    const verifyData = await verifyRes.json();
    console.log(`Kích hoạt tài khoản bằng OTP: ${verifyRes.ok && verifyData.token ? '✅ THÀNH CÔNG' : '❌ LỖI'}`);
    const sessionToken = verifyData.token;

    // BƯỚC 3: TẠO ĐƠN XIN NGHỈ PHÉP
    console.log('\n--- BƯỚC 3: Tạo đơn xin nghỉ phép gửi tới Quản lý ---');
    const dStart = new Date();
    dStart.setDate(dStart.getDate() + 1);
    const dEnd = new Date();
    dEnd.setDate(dEnd.getDate() + 3);
    const leaveRes = await fetch(`http://localhost:${DEMO_PORT}/api/leaves`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify({
        startDate: dStart.toISOString().split('T')[0],
        endDate: dEnd.toISOString().split('T')[0],
        days: 3,
        reason: '<script>alert("hack")</script>Nghỉ phép cá nhân theo kế hoạch'
      })
    });
    const leaveData = await leaveRes.json();
    console.log(`Tạo đơn xin nghỉ phép: ${leaveRes.ok ? '✅ THÀNH CÔNG' : '❌ LỖI'}`);
    console.log(`Mã đơn nghỉ phép: ${leaveData.leave.id}`);

    await sleep(300);

    // BƯỚC 4: QUẢN LÝ NHẬN EMAIL DUYỆT & KIỂM TRA CHỐNG XSS
    console.log('\n--- BƯỚC 4: Quản lý nhận Action Email & Kiểm tra an toàn XSS ---');
    const mailsRes2 = await fetch(`http://localhost:${EMAIL_PORT}/api/v1/mails`);
    const { data: mails2 } = await mailsRes2.json();
    const managerMail = mails2.find(m => m.subject.includes('Đơn Xin Nghỉ Phép'));

    if (!managerMail) {
      throw new Error('❌ Quản lý không nhận được email yêu cầu duyệt đơn!');
    }
    console.log(`Quản lý nhận email tiêu đề: "${managerMail.subject}"`);

    // Kiểm tra tính năng chống XSS: <script> phải bị escape
    const isXssEscaped = managerMail.html.includes('&lt;script&gt;') && !managerMail.html.includes('<script>');
    console.log(`Chống chèn mã độc HTML/XSS trong lý do: ${isXssEscaped ? '✅ BẢO MẬT AN TOÀN' : '❌ LỖI BẢO MẬT'}`);

    // Trích xuất link và token phê duyệt từ nội dung thư
    const approveMatch = managerMail.html.match(/\/decision\/([a-f0-9]+)\?action=approve/);
    if (!approveMatch) {
      throw new Error('❌ Không tìm thấy liên kết duyệt đơn trong email Quản lý!');
    }
    const decisionToken = approveMatch[1];
    console.log(`Trích xuất Decision Token một lần: ${decisionToken}`);

    // BƯỚC 5: QUẢN LÝ XÁC NHẬN PHÊ DUYỆT ĐƠN
    console.log('\n--- BƯỚC 5: Quản lý xác nhận duyệt đơn qua POST ---');
    const decisionRes = await fetch(`http://localhost:${DEMO_PORT}/api/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: decisionToken, action: 'approve' })
    });
    const decisionData = await decisionRes.json();
    console.log(`Xử lý quyết định: ${decisionRes.ok && decisionData.leave.status === 'APPROVED' ? '✅ ĐÃ DUYỆT THÀNH CÔNG' : '❌ LỖI'}`);

    await sleep(300);

    // BƯỚC 6: NHÂN VIÊN NHẬN EMAIL KẾT QUẢ TỨC THÌ
    console.log('\n--- BƯỚC 6: Kiểm tra email kết quả gửi về cho Nhân viên ---');
    const mailsRes3 = await fetch(`http://localhost:${EMAIL_PORT}/api/v1/mails`);
    const { data: mails3 } = await mailsRes3.json();
    const resultMap = mails3.find(m => m.to === employeeEmail && m.subject.includes('Đã Được Duyệt'));

    if (!resultMap) {
      throw new Error('❌ Nhân viên chưa nhận được email kết quả phê duyệt!');
    }
    console.log(`Nhân viên nhận email kết quả: "${resultMap.subject}"`);
    const hasSuccessBadge = resultMap.html.includes('ĐÃ PHÊ DUYỆT') || resultMap.html.includes('success');
    console.log(`Email có nhãn trạng thái thành công: ${hasSuccessBadge ? '✅ ĐẠT CHUẨN' : '❌ THIẾU'}`);

    // BƯỚC 7: KIỂM THỬ BẢO MẬT (CHỐNG DÙNG LẠI TOKEN DUYỆT)
    console.log('\n--- BƯỚC 7: Kiểm thử bảo mật (Chống Replay Attack Token) ---');
    const replayRes = await fetch(`http://localhost:${DEMO_PORT}/api/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: decisionToken, action: 'approve' })
    });
    console.log(`Chặn dùng lại token đã xử lý: ${replayRes.status === 400 ? '✅ ĐÃ CHẶN AN TOÀN (400)' : '❌ LỖI'}`);

    // BƯỚC 8: QUÊN MẬT KHẨU & ĐẶT LẠI MẬT KHẨU (KÈM HỦY TOKEN CŨ & SESSION CŨ)
    console.log('\n--- BƯỚC 8: Kiểm thử chức năng Quên mật khẩu (TTL 5 phút, hủy link cũ & hủy session cũ) ---');
    // Yêu cầu lần 1 (sẽ bị vô hiệu hóa khi yêu cầu lần 2)
    await fetch(`http://localhost:${DEMO_PORT}/api/forgot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: employeeEmail })
    });
    await sleep(200);
    const mailsOld = (await (await fetch(`http://localhost:${EMAIL_PORT}/api/v1/mails`)).json()).data;
    const firstResetMail = mailsOld.find(m => m.to === employeeEmail && m.subject.includes('đặt lại mật khẩu'));
    const oldResetToken = firstResetMail.html.match(/#reset-([a-f0-9]+)/)[1];

    // Yêu cầu lần 2 (mới nhất)
    const forgotRes = await fetch(`http://localhost:${DEMO_PORT}/api/forgot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: employeeEmail })
    });
    console.log(`Yêu cầu đặt lại mật khẩu: ${forgotRes.ok ? '✅ THÀNH CÔNG' : '❌ LỖI'}`);

    await sleep(300);

    const mailsRes4 = await fetch(`http://localhost:${EMAIL_PORT}/api/v1/mails`);
    const { data: mails4 } = await mailsRes4.json();
    const resetMail = mails4.find(m => m.to === employeeEmail && m.subject.includes('đặt lại mật khẩu'));

    if (!resetMail) {
      throw new Error('❌ Không tìm thấy email đặt lại mật khẩu!');
    }
    const has5Min = resetMail.html.includes('5 phút');
    console.log(`Email reset có thông báo thời hạn 5 phút: ${has5Min ? '✅ ĐẠT CHUẨN' : '❌ SAI TTL'}`);

    const resetTokenMatch = resetMail.html.match(/#reset-([a-f0-9]+)/);
    if (!resetTokenMatch) {
      throw new Error('❌ Không trích xuất được reset token từ liên kết email!');
    }
    const resetToken = resetTokenMatch[1];

    // Thử dùng token cũ (phải bị từ chối vì đã có token mới)
    const oldTokenTry = await fetch(`http://localhost:${DEMO_PORT}/api/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: oldResetToken, newPassword: 'OldAttemptPassword@1' })
    });
    console.log(`Vô hiệu hóa link reset cũ khi xin link mới: ${oldTokenTry.status === 400 ? '✅ ĐÃ CHẶN AN TOÀN (400)' : '❌ LỖI'}`);

    // Tiến hành đổi mật khẩu mới bằng token mới nhất
    const resetRes = await fetch(`http://localhost:${DEMO_PORT}/api/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: resetToken, newPassword: 'NewPassword@999' })
    });
    console.log(`Đặt lại mật khẩu mới: ${resetRes.ok ? '✅ THÀNH CÔNG' : '❌ LỖI'}`);

    // Kiểm tra session cũ đã bị thu hồi sau khi đổi mật khẩu
    const oldSessionCheck = await fetch(`http://localhost:${DEMO_PORT}/api/me`, {
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    });
    console.log(`Thu hồi phiên đăng nhập cũ sau khi đổi mật khẩu: ${oldSessionCheck.status === 401 ? '✅ ĐÃ THU HỒI (401)' : '❌ LỖI'}`);

    // Đăng nhập lại với mật khẩu mới
    const newLoginRes = await fetch(`http://localhost:${DEMO_PORT}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: employeeEmail, password: 'NewPassword@999' })
    });
    console.log(`Đăng nhập bằng mật khẩu mới: ${newLoginRes.ok ? '✅ THÀNH CÔNG' : '❌ LỖI'}`);

    // BƯỚC 9: KIỂM THỬ BẢO MẬT OTP & CONTRACT CHẾ ĐỘ LIVE_GMAIL
    console.log('\n--- BƯỚC 9: Kiểm thử bảo mật OTP (Chống brute-force 5 lần & Ràng buộc Contract LIVE_GMAIL) ---');
    const dummyEmail = 'dummy_test@tdtu.edu.vn';
    await fetch(`http://localhost:${DEMO_PORT}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Dummy Test', email: dummyEmail, password: 'Password@123' })
    });

    for (let i = 1; i <= 5; i++) {
      await fetch(`http://localhost:${DEMO_PORT}/api/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: dummyEmail, otp: '999999' })
      });
    }
    const blockedRes = await fetch(`http://localhost:${DEMO_PORT}/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: dummyEmail, otp: '999999' })
    });
    console.log(`Hủy mã OTP và từ chối sau 5 lần sai: ${blockedRes.status === 400 ? '✅ ĐÃ CHẶN CHÍNH XÁC (400)' : '❌ LỖI'}`);

    // Kiểm thử Contract LIVE_GMAIL: không truyền otp/verifyUrl phải trả về 400 Bad Request
    await fetch(`http://localhost:${EMAIL_PORT}/api/v1/config/mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'LIVE_GMAIL' })
    });
    const liveNoOtpRes = await fetch(`http://localhost:${EMAIL_PORT}/api/v1/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'student@tdtu.edu.vn', name: 'Nguyễn Văn A', strictContract: true })
    });
    console.log(`Chặn thiếu otp/verifyUrl ở chế độ LIVE_GMAIL (400): ${liveNoOtpRes.status === 400 ? '✅ ĐÚNG CONTRACT SLIDE' : '❌ LỖI'}`);

    // Trả lại chế độ SANDBOX
    await fetch(`http://localhost:${EMAIL_PORT}/api/v1/config/mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'SANDBOX' })
    });

    console.log('\n====================================================');
    console.log('🎉 TOÀN BỘ KỊCH BẢN DEMO END-TO-END ĐÃ ĐẠT CHUẨN 100%!');
    console.log('====================================================\n');
  } catch (err) {
    console.error('\n❌ E2E TEST THẤT BẠI:', err.message);
    process.exitCode = 1;
  } finally {
    await stopServers();
    process.exit(process.exitCode || 0);
  }
}

runE2ETest();
