#!/usr/bin/env bash

# Gmail-SMTP-Service - 1-Click Starter
# Tương thích: macOS & Ubuntu / Linux

echo "  GMAIL-SMTP-SERVICE: EMAIL GATEWAY (PORT 3000)"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "[Loi] May tinh cua ban chua cai dat Node.js!"
  echo "Vui long cai dat Node.js tai https://nodejs.org"
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "[Thong bao] Dang cai dat dependencies lan dau..."
  npm install
fi

echo "[Thong bao] Dang khoi dong Email Service Gateway..."

if command -v open >/dev/null 2>&1; then
  open "http://localhost:3000"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://localhost:3000" >/dev/null 2>&1 &
fi

npm start
