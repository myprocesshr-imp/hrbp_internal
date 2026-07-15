# HRBP Internal — ระบบจัดการเอกสารใบรับรอง

ระบบจัดการคำขอเอกสารรับรองการทำงาน สำหรับพนักงานและ HR

## Quick Start

```bash
npm install
npm run dev
```

รัน frontend (Vite, port 3000) + backend (Wrangler + D1, port 8788) พร้อมกัน

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | รัน frontend + backend พร้อมกัน |
| `npm run dev:frontend` | รัน Vite dev server (port 3000) |
| `npm run dev:backend` | รัน Wrangler dev server (port 8788) |
| `npm run build` | Build frontend |
| `npm run deploy` | Deploy ขึ้น Cloudflare Pages |
| `npm run migrate:local` | Run migrations บน local D1 |
| `npm run migrate:all:local` | Run all migrations บน local D1 |
| `npm run migrate:all` | Run all migrations บน remote D1 |

## Architecture

```
├── app/                    Frontend (Vite + Vanilla JS SPA)
├── cloudflare/             Backend (Cloudflare Pages Functions + D1 + R2)
├── workers/                R2 Storage Worker
├── hrbp_template/          DOCX certificate templates
├── docs/                   Documentation
└── package.json            Root package.json
```

## Login (Development)

| Username | Role | Description |
|----------|------|-------------|
| `admin` | admin | Admin User |
| `ronnachai_w` | admin | รณชัย วิจิตโต |
| `chatchawan_tu` | admin | ชัชวาลย์ ตุลาผล |
| `penpitcha_po` | hrbp | เพ็ญพิชชา พงษ์ประสิทธิ์ |

Password: anything

## Tech Stack

- **Frontend:** Vanilla JS SPA (Vite)
- **Backend:** Cloudflare Pages Functions (Workers)
- **Database:** Cloudflare D1 (SQLite)
- **Storage:** Cloudflare R2
- **UI:** Tailwind CSS + Material Symbols