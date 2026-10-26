#!/usr/bin/env bash
# HR Leave Portal & Email Gateway - 1-Click Demo
# Tương thích: macOS & Ubuntu / Linux

echo "  DEMO END-TO-END: UNG DUNG XIN NGHI PHEP (TMT COMPANY)"
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

echo "[Thong bao] Dang khoi dong ca hai dich vu (Email Gateway: 3000, App: 4000)..."

# Tu dong mo trinh duyet tren macOS (open) hoac Linux (xdg-open)
if command -v open >/dev/null 2>&1; then
  open "http://localhost:4000"
  open "http://localhost:3000"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://localhost:4000" >/dev/null 2>&1 &
  xdg-open "http://localhost:3000" >/dev/null 2>&1 &
fi

node scripts/run-demo.js
