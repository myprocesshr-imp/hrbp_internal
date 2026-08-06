# HRBP Internal — System Test Guide

> **Version:** 1.0 | **Date:** 2026-07-21
> **URL:** https://hrbp-internal.pages.dev
> **D1:** Fresh (migrations 000–013 applied) | **R2:** Empty

---

## 0. Test Accounts (D1 Seed Data)

| # | Username | Role | emp_id | Notes |
|---|----------|------|--------|-------|
| 1 | `chatchawan_tu` | admin | 10005208 | Full admin access |
| 2 | `ronnachai_w` | admin | 648087 | Full admin access |
| 3 | `wipada.r` | hrmanager | EMP-2024-001 | HR Manager |
| 4 | `penpitcha_po` | hrbp | 670406 | HRBP — lands on Requests tab |
| 5 | `chaiyaphol.r` | hrbp | EMP-2024-015 | HRBP — lands on Requests tab |
| 6 | `employee` | employee | EMP-2024-0892 | Regular employee |

> **New user test:** Register any username not in the list → auto-provisioning flow.

---

## 1. Login

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1.1 | Login with valid credentials (existing user) | Enter `chatchawan_tu` + password | IDMS call → D1 lookup → navigates to `#/admin/dashboard` |
| 1.2 | Login with valid credentials (new user) | Enter any username not in DB | IDMS call → `needsProvisioning` → HRMS fetch → Confirm Profile form → Register → navigates to role landing |
| 1.3 | Login with wrong password | Enter valid username + wrong password | IDMS fails → fallback empId → D1 lookup fails → provisioning flow triggered (password not validated against D1) |
| 1.4 | Password visibility toggle | Click eye icon | Toggles between password/text |
| 1.5 | Empty form validation | Click Login without entering data | Error: "กรุณากรอกข้อมูลให้ครบถ้วน" |
| 1.6 | Cancel provisioning | Start new user flow → click Cancel | Returns to login form |
| 1.7 | Language toggle | Switch TH↔EN on login page | All labels change language |

---

## 2. Employee — New Request

> Login as `employee` → "สร้างเอกสารใหม่"

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 2.1 | View form (self) | Login as `employee`, click "สร้างเอกสารใหม่" | Step 1 shows employee info auto-filled (name, dept, position, company, start date) |
| 2.2 | Select document type | Click a document card (e.g., "หนังสือรับรองการทำงาน") | Card highlighted, selected |
| 2.3 | Select purpose | Choose "Bank Loan" | Additional field: Institution name appears |
| 2.4 | Select purpose — Visa | Choose "Visa Application" | Country dropdown + Travel date fields appear |
| 2.5 | Select purpose — Overseas | Choose "Overseas Work" | Destination country + Start/End date fields appear |
| 2.6 | Select purpose — Other | Choose "Other" | Custom text input appears |
| 2.7 | Delivery method — Digital only | Keep "Digital" checked, uncheck Physical | No pickup location shown |
| 2.8 | Delivery method — Physical | Check "Physical Document" | Pickup location picker appears, required |
| 2.9 | Delivery method — Both | Check both Digital + Physical | Both options visible, pickup location required |
| 2.10 | Upload supporting documents | Drag & drop or click to upload PDF/JPG/PNG | File appears in list, shows name + size |
| 2.11 | Upload file too large | Try upload >10MB file | Error: file size limit |
| 2.12 | Upload too many files | Try upload >5 files | Error: file count limit |
| 2.13 | Remove uploaded file | Click delete icon on uploaded file | File removed from list |
| 2.14 | Preview request | Fill all required fields → click "Preview" | Modal shows all data: employee info, request details, delivery method |
| 2.15 | Submit request | Preview → click "Submit" | Request created with status `submitted`, navigates to My Requests |
| 2.16 | Submit without required fields | Skip document type → click Submit | Validation error shown |
| 2.17 | Select HR Officer | In Step 1, select an HR from the table | HR officer assigned to request |

---

## 3. Employee — My Requests

> Login as `employee` → "คำขอของฉัน"

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 3.1 | View KPI cards | Page loads | Shows: Avg processing time, Success rate, Open requests |
| 3.2 | View request table | Page loads | Shows columns: Request ID, Date, Type, Attachments, Status, ETA, Actions |
| 3.3 | Filter by status | Select "รอดำเนินการ" from status dropdown | Table shows only `submitted` + `in-review` requests |
| 3.4 | Search by request ID | Type `EC-` in search box | Filters to matching requests |
| 3.5 | Cancel submitted request | Click "ยกเลิก" on a `submitted` request | Confirmation → status changes to `cancelled`, button removed |
| 3.6 | Cancel in-review request | Click "ยกเลิก" on an `in-review` request | Confirmation → status changes to `cancelled` |
| 3.7 | Download approved cert | Click "ดาวน์โหลด" on `approved` request (within download window) | Download starts |
| 3.8 | Download expired cert | Click download on approved request past `cert_download_until` | Download button disabled, expiry notice shown |
| 3.9 | Resubmit rejected request | Click "ส่งใหม่" on `rejected` request | Navigates to new request form with all fields pre-filled |
| 3.10 | View tracker modal | Click request row or tracker icon | Modal shows 4-step progress: Submit → HRBP Review → Approve/Reject → Delivery |
| 3.11 | Tracker — physical delivery status | View tracker for approved physical request | Shows delivery status (delivered/not delivered) |
| 3.12 | Tracker — rejection reason | View tracker for rejected request | Shows rejection reason text |
| 3.13 | Pagination | Have >10 requests → navigate pages | Page numbers shown, correct items per page |

---

## 4. Admin — Dashboard

> Login as `chatchawan_tu` → "แดชบอร์ด"

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 4.1 | View KPI cards | Page loads | 6 cards: Total, Pending, Approved, To Deliver, Rejected, Today's Tasks |
| 4.2 | KPI card click filtering | Click "Total Requests" card | Table shows all requests; card gets highlight |
| 4.3 | KPI — To Deliver count | Approve physical request without delivery | "To Deliver" count increments |
| 4.4 | View request table | Page loads | Columns: Requester, Doc No., Department, Type, Status, Date, ETA, HR, Actions |
| 4.5 | Filter by status | Select status from KPI or dropdown | Table filters correctly |
| 4.6 | Search | Type in search box | Filters by requester name or doc number |
| 4.7 | Pagination | Navigate pages | 5 items per page, correct page numbers |
| 4.8 | CSV Export | Click export button | Downloads CSV with all request data |
| 4.9 | Monthly chart | Page loads | Bar chart shows pending/approved/rejected/cancelled by month |
| 4.10 | SLA alerts | Pending requests exist | Warning banner shown |
| 4.11 | Delivered badge | Physical request marked as delivered | Green "Delivered" badge on row, teal background |

---

## 5. Admin — Request Actions

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 5.1 | View details (submitted) | Click "ดูรายละเอียด" on `submitted` request | Modal: employee info, request details, attachments, action buttons |
| 5.2 | Acknowledge case | Click "รับเคส" on `submitted` request | Status → `in-review`, HR name recorded |
| 5.3 | Set ETA | Click "กำหนดวันส่งมอบ" on `in-review` request | Date picker → save → ETA shown in table |
| 5.4 | Edit ETA | Click "แก้ไข ETA" on request with existing ETA | Date picker with current value → update |
| 5.5 | Create Certificate | Click "สร้างเอกสาร" on `in-review` request with ETA | Navigates to Certificate Builder |
| 5.6 | Reject request | Click "ปฏิเสธ" → enter rejection reason → confirm | Status → `rejected`, reason saved, employee sees reason |
| 5.7 | Mark physical delivered | Click "ยืนยันการส่งมอบ" on approved physical request | `physical_delivered = true`, green badge appears |
| 5.8 | View certificate record | Open detail modal for approved request | Shows: cert number, issue date, template, signer, officer, remark |

---

## 6. Certificate Builder

> From request detail → "สร้างเอกสาร" or from admin navigation

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 6.1 | Open builder | Click "สร้างเอกสาร" on in-review request | A4 preview with request data auto-filled |
| 6.2 | Select template | Change template dropdown | Document content updates (Thai/English, salary/no-salary) |
| 6.3 | Edit body text | Click on editable fields (name, dept, etc.) | Inline editing, changes reflected in preview |
| 6.4 | Edit salary | For salary template, click salary field | Editable, formatted as currency |
| 6.5 | Select purpose/remark | Click purpose field → dropdown appears | Choose from preset options or type custom |
| 6.6 | Select signer | Click signer dropdown | List of HR managers from DB |
| 6.7 | Select HR officer | Click officer dropdown | List of HRBP users from DB |
| 6.8 | Upload signature | Signature Manager → upload image | Signature appears in preview area |
| 6.9 | Save certificate | Click "บันทึก" | Cert number allocated, `cert_ready = true`, `can_download = true` |
| 6.10 | Print PDF | Click "พิมพ์" → browser print dialog | A4 layout ready for print/PDF save |
| 6.11 | Cert number format | Save certificate | Number: `XXXX/BBBB` (counter/Buddhist year, e.g., `0001/2569`) |
| 6.12 | Download window set | Save certificate | `cert_download_until` = issue date + configured days (default 30) |

---

## 7. Admin — Settings

> Login as admin → "ตั้งค่า"

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| **Business Units** |||
| 7.1 | View BUs | Click "หน่วยธุรกิจ" tab | Table shows seeded BUs |
| 7.2 | Add BU | Click "เพิ่ม" → enter name → save | New BU appears in table |
| 7.3 | Duplicate BU | Try add existing BU name | Error: "Business unit already exists" |
| 7.4 | Edit BU | Click edit icon → change name → save | Name updated |
| 7.5 | Delete BU | Click delete → confirm | BU removed from table |
| **Pickup Locations** |||
| 7.6 | View locations | Click "จุดรับเอกสาร" tab | Shows: DAP, IP1-อาคารพลาซ่า2, One BKK |
| 7.7 | Add/Edit/Delete | CRUD operations | Works same as BUs |
| **Delivery Methods** |||
| 7.8 | View methods | Click "วิธีการจัดส่ง" tab | Shows 5 seeded methods |
| 7.9 | Add/Edit/Delete | CRUD operations | Works same as BUs |
| **Certificate Master Data** |||
| 7.10 | View master data | Click "ข้อมูลเอกสาร" tab | Shows: Download window, Companies, Addresses, Notes |
| 7.11 | Set download window | Change days (e.g., 60) → save | New value persists, affects future certs |
| 7.12 | Add company | Enter Thai + English name → save | Company added |
| 7.13 | Add address | Select company → enter address → save | Address linked to company |
| 7.14 | Add note/remark | Enter Thai + English text → save | Note added to dropdown options |

---

## 8. Admin — User Management

> Login as admin → "จัดการผู้ใช้"

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 8.1 | View user list | Page loads | Shows all users with avatar, name, dept, role, BU, status |
| 8.2 | View metrics | Page loads | Total users, HR count, Employee count |
| 8.3 | Search users | Type in search box | Filters by name/emp code/dept |
| 8.4 | Filter by role | Select role dropdown | Filters to matching role |
| 8.5 | Edit user role | Click edit → change role → save | Role badge updates |
| 8.6 | Assign responsible BU | Edit user → select BU(s) → save | BU shown in table |
| 8.7 | Toggle user status | Edit user → toggle active/inactive | Status badge changes |
| 8.8 | Add new user | Click "เพิ่มผู้ใช้" → enter username + name → save | User appears in table |

---

## 9. Admin — Templates

> Login as admin → "เทมเพลต"

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 9.1 | View templates | Page loads | Table: Name, Category, Language, Status, Updated |
| 9.2 | Filter by status | Select "Published" | Only published templates shown |
| 9.3 | Search templates | Type template name | Filters correctly |
| 9.4 | Create template | Click "สร้าง" → fill name, category, HTML content → save | Template created (status: Draft) |
| 9.5 | Publish template | Edit template → change status to Published | Template available in Certificate Builder dropdown |
| 9.6 | Disable template | Edit → change status to Disabled | Template hidden from Certificate Builder |
| 9.7 | Delete template | Click delete → confirm | Template removed |

---

## 10. On-Behalf Request (HR)

> Login as `chatchawan_tu` (admin) → สร้างเอกสารแทนพนักงาน

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 10.1 | Access on-behalf form | Navigate to new request → click "สร้างแทนพนักงาน" | Amber banner: "HR สร้างเอกสารแทนพนักงาน" |
| 10.2 | Search employee | Enter employee ID → click search | Employee data fetched from HRMS, form populated |
| 10.3 | Submit on-behalf | Fill form → submit | Request created with employee's identity, not HR's |

---

## 11. Language (i18n)

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 11.1 | Toggle language | Click TH/EN toggle in nav | All UI labels switch |
| 11.2 | Language persists | Switch to EN → refresh page | Stays in EN |
| 11.3 | Date format TH | View dates in Thai mode | Buddhist year (พ.ศ. = Gregorian + 543) |
| 11.4 | Date format EN | View dates in English mode | Gregorian year, English month names |

---

## 12. File Upload & R2

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 12.1 | Upload supporting doc | New request → upload PDF | File uploaded to R2, key returned |
| 12.2 | Download supporting doc | Admin detail modal → click file link | File downloads from R2 |
| 12.3 | Upload signature | Certificate Builder → Signature Manager → upload | Image stored in R2, displayed in cert |

---

## 13. Edge Cases

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 13.1 | Employee-cancelled vs HR-rejected | Cancel as employee vs reject as HR | Different status labels and colors |
| 13.2 | Download window expiry | Issue cert → wait past download window | Download button disabled, expiry notice |
| 13.3 | Resubmit rejected request | Employee clicks "ส่งใหม่" on rejected | Form pre-filled with original data |
| 13.4 | Concurrent login | Two tabs logged in as same user | Both sessions work independently |
| 13.5 | Refresh mid-action | Refresh page during form fill | Form resets (no draft save) |
| 13.6 | Deep link navigation | Navigate directly to `#/admin/dashboard` | Requires login, redirects to `#/login` if not authenticated |
| 13.7 | 404 route | Navigate to `#/nonexistent` | Redirects to `#/login` |

---

## Quick Smoke Test (5 min)

1. **Login** as `chatchawan_tu` → lands on Dashboard ✓
2. **Create request** as `employee` → submit ✓
3. **Admin acknowledge** → set ETA → status `in-review` ✓
4. **Create certificate** in Builder → save → cert number allocated ✓
5. **Employee download** → file downloads within window ✓
6. **Settings** → add/delete BU → works ✓
7. **Language toggle** → TH↔EN switches all labels ✓

---

## Known Limitations

- Password is not validated against IDMS on the app side (IDMS handles auth)
- "Remember me" and "Forgot password" are UI-only, no backend
- Draft requests are not persisted (form resets on refresh)
- Signature images stored in localStorage + R2 (not D1)
- Employee avatars loaded from external HRMS endpoint (may be slow/unavailable)
