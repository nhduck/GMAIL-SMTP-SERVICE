@echo off
title HR Leave Portal & Email Gateway - 1-Click Demo
echo  DEMO END-TO-END: UNG DUNG XIN NGHI PHEP
echo.

node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [Loi] May tinh cua ban chua cai dat Node.js!
    echo Vui long cai dat Node.js tai https://nodejs.org
    pause
    exit /b
)

if not exist node_modules (
    echo [Thong bao] Dang cai dat dependencies lan dau...
    call npm install
)

echo [Thong bao] Dang khoi dong ca hai dich vu (Email Gateway: 3000, App: 4000)...
timeout /t 2 >nul
start "" "http://localhost:4000"
start "" "http://localhost:3000"
node scripts/run-demo.js
