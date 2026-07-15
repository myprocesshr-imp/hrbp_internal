# R2 Storage Worker — Setup Guide

## ขั้นตอนที่ 1: สมัคร Cloudflare Account

1. ไปที่ https://dash.cloudflare.com/sign-up
2. สมัครฟรี (ต้องเพิ่มบัตรเครดิตสำหรับ R2 แต่มี free tier 10GB)
3. ยืนยันอีเมลและเข้าสู่ระบบ

## ขั้นตอนที่ 2: สร้าง R2 Bucket

```bash
# login Cloudflare
npx wrangler login

# สร้าง bucket ชื่อ hrbp-files
npx wrangler r2 bucket create hrbp-files
```

## ขั้นตอนที่ 3: Deploy Worker

```bash
cd workers/r2-storage

# สร้าง API Key (ใช้รหัสอะไรก็ได้ ยาวๆ เช่น openssl rand -hex 32)
npx wrangler secret put API_KEY
# เมื่อถาม ให้ป้อน API key ที่ต้องการ

# ตั้งค่า CORS_ORIGIN (กรณี deploy แล้วใช้ domain จริง)
npx wrangler secret put CORS_ORIGIN
# ป้อน URL frontend เช่น https://hrbp.vercel.app หรือ * สำหรับ dev

# Deploy Worker
npx wrangler deploy
```

เมื่อ deploy เสร็จจะได้ Worker URL ประมาณ:
`https://hrbp-r2-storage.<your-subdomain>.workers.dev`

## ขั้นตอนที่ 4: อัปเดต Frontend

เปิดไฟล์ `app/.env` แล้วแก้:

```env
VITE_R2_WORKER_URL=https://hrbp-r2-storage.<your-subdomain>.workers.dev
VITE_R2_API_KEY=<API Key ที่ตั้งไว้>
```

## โครงสร้างไฟล์ที่สร้าง

```
workers/r2-storage/
├── package.json
├── wrangler.toml
├── SETUP.md
└── src/
    └── index.js          # Worker endpoints: upload, download, delete, list

app/src/lib/
└── r2-storage.js         # Frontend helper: uploadFile, getFileUrl, deleteFile, listFiles
```

## API Endpoints

| Method | Path | Auth | คำอธิบาย |
|--------|------|------|----------|
| POST | `/upload` | X-API-Key | อัปโหลดไฟล์ (form-data: file, prefix) |
| GET | `/file/:key` | - | ดาวน์โหลด/ดูไฟล์ |
| DELETE | `/file/:key` | X-API-Key | ลบไฟล์ |
| GET | `/list?prefix=...` | X-API-Key | ดูรายการไฟล์ |

## R2 Object Key Structure

```
supporting-docs/{uuid}-{filename}   → เอกสารแนบคำขอ
certificates/{uuid}-{filename}      → ใบรับรอง PDF ที่ HR ออกให้ (ใช้ในอนาคต)
```

## Frontend Usage

```javascript
import { uploadFile, getFileUrl, deleteFile } from '../lib/r2-storage.js';

// อัปโหลด
const result = await uploadFile(file, 'supporting-docs');

// ดูลิงก์ไฟล์
const url = await getFileUrl(result.key);

// ลบ
await deleteFile(result.key);
```
