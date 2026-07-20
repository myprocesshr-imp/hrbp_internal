# Migration Guide: Supabase → Cloudflare (D1 + R2 + Pages)

## Architecture

```
Before:                    After:
Vite Dev Server            Cloudflare Pages
  ├── Supabase DB           ├── D1 Database (SQLite)
  ├── Vite Proxy (HRMS)     ├── Pages Functions API
  └── (no storage)          │   └── auth, users, bus, upload, file
                            ├── R2 Storage (files)
                            └── Proxy HRMS via fetch()
```

## ขั้นตอน Deploy

### 1. สร้าง D1 Database

```bash
cd cloudflare

# ล็อกอิน Cloudflare
npx wrangler login

# สร้าง D1 database
npx wrangler d1 create hrbp-db
# → ได้ database_id เช่น xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# อัปเดต database_id ใน wrangler.toml

# รัน migration (สร้างตาราง)
npx wrangler d1 execute hrbp-db --file=./migrations/001_schema.sql
```

### 2. สร้าง R2 Bucket

```bash
npx wrangler r2 bucket create hrbp-files
```

### 3. ตั้งค่า API Key สำหรับอัปโหลดไฟล์

```bash
npx wrangler pages secret put API_KEY
# ป้อนรหัสลับ (ใช้ openssl rand -hex 32 หรืออะไรก็ได้)
```

### 4. Deploy Frontend + API

```bash
# สร้าง production build
cd app
npm run build

# Deploy ไปยัง Cloudflare Pages
cd ../cloudflare
npx wrangler pages deploy ../app/dist --branch main
```

เมื่อ deploy เสร็จจะได้ URL เช่น `https://hrbp-internal-xxx.pages.dev`

### 5. (Optional) ตั้งค่า Custom Domain

ใน Cloudflare Dashboard → Pages → hrbp-internal → Custom domains → เพิ่ม domain

## Testing Locally

```bash
cd cloudflare

# รัน migration ใน local D1
npx wrangler d1 execute hrbp-db --local --file=./migrations/001_schema.sql

# รัน dev server (Frontend + Functions + D1 + R2)
npx wrangler pages dev ../app/dist --d1 DB --r2 HRBP_BUCKET --binding API_KEY=test
```

## สิ่งที่ต้องเปลี่ยนใน Frontend

### แทนที่ Supabase imports ด้วย API client:

```js
// ก่อน
import { supabase } from '../lib/supabase.js';
const { data } = await supabase.from('users').select('*');

// หลัง
import { getUsers } from '../lib/api.js';
const { users } = await getUsers();
```

### ไฟล์ที่ต้องอัปเดต:

| ไฟล์ | Supabase query | เปลี่ยนเป็น |
|------|---------------|------------|
| `login.js` | `supabase.from('users').select().eq('username',...)` | `api.login()` / `api.register()` |
| `login.js` | `supabase.from('users').insert()` | `api.register()` |
| `admin-users.js` | `supabase.from('users').select('*')` | `getUsers()` |
| `admin-users.js` | `supabase.from('users').update()` | `updateUser(id, data)` |
| `admin-users.js` | `supabase.from('business_units').select()` | `getBusinessUnits()` |
| `admin-settings.js` | `supabase.from('business_units')` CRUD | `api` CRUD functions |
| `employee-new-request.js` | `supabase.from('users').select().eq('role','admin')` | `getUsers('admin')` |
| `employee-new-request.js` | `uploadFile()` from r2-storage.js | `uploadFile()` from api.js (same API) |

### Proxy HRMS (ไม่ต้องเปลี่ยน)

Pages Functions จะ proxy ให้อัตโนมัติ โดยใช้ `fetch` ภายใน function ถ้าต้องการ แต่ปัจจุบัน vite.config.js proxy ไว้แล้ว — กรณี deploy จริงต้องเพิ่ม proxy logic ใน Pages Functions หรือเรียก API โดยตรง

## Rollback Plan

ถ้าต้องการกลับไปใช้ Supabase:
1. `git checkout -- app/src/lib/` (คืนค่า supabase imports)
2. Cloudflare Dashboard → Pages → Delete project
3. ใช้ Vite Dev Server เหมือนเดิม
