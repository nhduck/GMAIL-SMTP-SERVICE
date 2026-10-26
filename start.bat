@echo off
title Auth-Email Hub - 1-Click Starter
echo     EMAIL GATEWAY - SOA
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

echo [Thong bao] Dang khoi dong Email Service Gateway...
start "" "http://localhost:3000"
npm start
