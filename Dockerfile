FROM node:20-alpine

WORKDIR /app

# Cài đặt dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Sao chép toàn bộ mã nguồn
COPY . .

# Mở 2 cổng dịch vụ (3000: Email Gateway, 4000: HR Leave Portal)
EXPOSE 3000 4000

# Khởi chạy cả 2 microservices
CMD ["node", "scripts/run-demo.js"]
