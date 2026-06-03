# 牙醫診所回診提醒系統 (Clinic Recall System)

診所內網使用的回診提醒與病患管理系統。把櫃檯的紙本回診記錄數位化，核心是一個多階段
聯絡流程（LINE → 電話①②③）與「今日待辦」四分組清單。完整規格見 [`spec.md`](./spec.md)。

## 技術棧

- **前端**：React 18 + Vite + Tailwind CSS + React Router
- **後端**：Node.js + Express
- **資料庫**：PostgreSQL 16（Prisma ORM）
- **認證**：express-session + connect-pg-simple + bcrypt
- **測試**：Vitest（+ supertest / React Testing Library）

## 專案結構

```
clinic-recall-system/
├── docker-compose.yml   # PostgreSQL 16
├── client/              # React + Vite 前端
└── server/              # Express + Prisma 後端
```

## 開發環境啟動

需求：Node 20+、Docker。

```bash
# 1. 複製環境變數到 server/（Prisma 與後端從這裡讀取）
copy .env.example server\.env   # macOS/Linux: cp .env.example server/.env

# 2. 啟動 PostgreSQL（docker-compose 已內建預設帳密，不需 .env）
npm run db:up

# 3. 安裝相依套件
npm install
npm --prefix server install
npm --prefix client install

# 4. 建立資料表並產生 Prisma client
npm run migrate

# 5. 建立第一個管理員帳號
npm run seed:admin -- admin "your-password"

# 6. 同時啟動前後端 (server:3000, client:5173)
npm run dev
```

開啟 http://localhost:5173 ，以管理員帳號登入。

## 測試

```bash
npm test            # server + client
```

## 正式部署（內網）

`npm run build` 產生 `client/dist`，由 Express 同源提供靜態檔；以 pm2 / systemd 常駐。
詳見 `spec.md` 第 11–12 節。
