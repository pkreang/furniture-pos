# Furniture House POS — Production Design Spec

วันที่: 2026-05-17
สถานะ: รออนุมัติ

## 1. ภาพรวม (Overview)

ยกระดับ Furniture House POS จาก demo (เว็บ vanilla JS ที่เก็บข้อมูลในหน่วยความจำ)
ให้เป็นระบบใช้งานจริงสำหรับร้านเฟอร์นิเจอร์ของเจ้าของเอง 5 สาขา โดยสร้างระบบหลังบ้าน
(เซิร์ฟเวอร์ + ฐานข้อมูล) ขึ้นใหม่ และเขียนหน้าบ้านใหม่ด้วย Vue เพื่อให้ข้อมูลถูกบันทึก
ถาวร ปลอดภัย และทุกสาขาเห็นข้อมูลชุดเดียวกัน

เป้าหมาย v1: ฟีเจอร์ครบเทียบเท่า demo เดิมทุกหน้า (Dashboard, POS, Stock, Products,
Customers, Receipts/Refund, Quotations, Outstanding, Z-Report, Delivery, Reports,
Settings) แต่ทำงานบนสถาปัตยกรรมจริง

## 2. ข้อจำกัดและการตัดสินใจ (Constraints & Decisions)

| หัวข้อ | การตัดสินใจ |
|--------|-------------|
| ลักษณะระบบ | ใช้ภายในร้านตัวเอง 5 สาขา — single-tenant ไม่มี multi-tenant/billing |
| ขอบเขต v1 | ครบทุกฟีเจอร์เทียบเท่า demo |
| โหมดออฟไลน์ | ไม่รองรับ — ออนไลน์อย่างเดียว (เน็ตล่ม = สาขานั้นขายไม่ได้ชั่วคราว) |
| ภาษี | จดทะเบียน VAT — คิด VAT 7% และออกใบกำกับภาษีเต็มรูปแบบ |
| ราคา | ราคาที่ตั้งในระบบ **รวม VAT แล้ว** — ระบบถอดฐานภาษี/ยอด VAT ออกมาให้ |
| Hosting | เช่า VPS เครื่องเดียว ผู้ใช้ดูแลเอง |
| อุปกรณ์ | พิมพ์เอกสารผ่านเบราว์เซอร์เท่านั้น (ไม่มีสแกนเนอร์/ลิ้นชัก/เครื่องรูดบัตร) |
| Frontend | Vue 3 + Vite + TypeScript (เขียนใหม่ทั้งหมด) |
| Backend | Node.js + Fastify + TypeScript |
| ฐานข้อมูล | PostgreSQL + Prisma (ORM + migrations) |

## 3. สถาปัตยกรรม (Architecture)

ทุกส่วนรันบน VPS เครื่องเดียว:

```
                       VPS (1 เครื่อง)
┌──────────────────────────────────────────────────────┐
เบราว์เซอร์ ──HTTPS──▶ nginx ──┬──▶ Vue SPA (ไฟล์ static)
(สาขา 1-5)         (reverse    │
                    proxy+TLS) └──▶ Node API (Fastify) ──▶ PostgreSQL
                                          │
                                          └─ SSE push (real-time)
```

- **Vue SPA** — build เป็นไฟล์ static, nginx เสิร์ฟตรง
- **Node API (Fastify)** — REST API + ช่องทาง real-time (SSE)
- **PostgreSQL** — ฐานข้อมูลกลาง ทุกสาขาใช้ร่วมกัน
- **Docker Compose** — จัดการ container ของ Postgres + API ให้ติดตั้ง/ย้ายเครื่อง/
  อัปเดตซ้ำได้เหมือนเดิมทุกครั้ง
- **nginx** — reverse proxy + TLS (ใบรับรองฟรีจาก Let's Encrypt) บังคับ HTTPS
- **Auth** — session cookie แบบ `httpOnly` (ปลอดภัยกว่าเก็บ token ใน localStorage)

Data flow: Browser → HTTPS → nginx → Fastify API → Postgres

## 4. หลังบ้าน (Backend)

### 4.1 โครงสร้าง API

API แบ่งเป็นโมดูลตามโดเมน (ล้อกับหน้าใน demo) แต่ละโมดูล = routes + service + repository:

`auth` · `users-roles` · `branches` · `catalog` (สินค้า/หมวด/วัสดุโซฟา) ·
`stock` (สต็อกรายสาขา/โอน/ปรับ) · `customers` · `sales` (เช็คเอาท์/ใบเสร็จ/คืนเงิน) ·
`quotations` · `outstanding` (ยอดมัดจำค้างชำระ) · `deliveries` · `reports`
(Z-report/รายงานประจำวัน) · `audit` · `import-export`

### 4.2 หลักการสำคัญ: Transaction

การเช็คเอาท์ 1 ครั้ง = 1 database transaction — บันทึกบิล + รายการสินค้า + ตัดสต็อก +
บันทึก stock movement + เพิ่มแต้มลูกค้า + ออกเลขใบกำกับภาษี + เขียน audit log
ทั้งหมดสำเร็จพร้อมกันหรือ rollback พร้อมกัน ไม่มีสถานะครึ่ง ๆ กลาง ๆ

การคืนเงิน/ยกเลิกบิล และการโอนสต็อกระหว่างสาขา ก็ใช้ transaction เช่นเดียวกัน

### 4.3 Auth & RBAC (บังคับฝั่งเซิร์ฟเวอร์ทั้งหมด)

- รหัสผ่าน hash ด้วย **argon2** ฝั่งเซิร์ฟเวอร์ — เลิกใช้ cyrb53 ของ demo
- Login สำเร็จ → ออก session cookie (`httpOnly`, `secure`, `sameSite`)
- บังคับเปลี่ยนรหัสผ่านในการเข้าใช้ครั้งแรก
- ทุก endpoint ผ่าน middleware ตรวจ permission ตามบทบาท
- **Branch-scoping** — ผู้ใช้ที่บทบาทผูกกับสาขา (manager, cashier) API จะกรองข้อมูล
  เฉพาะ `branch_id` ของผู้ใช้นั้นเสมอ ไม่ว่า client จะส่งค่าใดมา
- เพดานส่วนลดตามบทบาท (`discountMaxPercent`) ตรวจสอบที่เซิร์ฟเวอร์
- บทบาทและสิทธิ์เก็บในฐานข้อมูล (`roles`, `permissions`, `role_permissions`)

## 5. ฐานข้อมูล (Data Model — PostgreSQL)

ทุกอย่างที่ demo เก็บใน `AppData`/`State` ในหน่วยความจำ จะย้ายมาเป็นตารางจริง

| กลุ่ม | ตารางหลัก |
|-------|-----------|
| องค์กร/สิทธิ์ | `branches`, `users`, `roles`, `permissions`, `role_permissions`, `sessions` |
| แคตตาล็อก | `categories`, `products`, `product_variants` (ขนาด/สี/วัสดุ), `sofa_materials`, `sofa_colors` |
| คลัง | `stock_levels` (สินค้า×สาขา), `stock_movements` (บันทึกทุกการเปลี่ยนแปลง), `transfers` |
| ลูกค้า | `customers` (รวมช่องข้อมูลภาษี), `point_transactions` |
| การขาย | `sales`, `sale_items`, `payments`, `tax_invoices`, `number_sequences` |
| ใบเสนอราคา | `quotations`, `quotation_items` |
| จัดส่ง | `deliveries`, `delivery_zones`, `delivery_channels`, `delivery_teams`, `drivers`, `delivery_status_history` |
| รายงาน/ระบบ | `z_reports`, `daily_report_history`, `audit_log`, `app_settings` |

หมายเหตุ:
- `number_sequences` — เซิร์ฟเวอร์ออกเลขบิลและเลขใบกำกับภาษี รันต่อเนื่องแยกรายสาขา
  กันเลขชนกันเวลาหลายสาขาขายพร้อมกัน
- `stock_movements` — บันทึกการเปลี่ยนสต็อกทุกครั้ง (ขาย/โอน/ปรับ/นำเข้า) เพื่อตรวจสอบย้อนหลังได้
- ระดับสมาชิก (tier) ของลูกค้าคำนวณจากยอดสะสม ไม่ต้องเก็บเป็นคอลัมน์แยก

## 6. หน้าบ้าน (Frontend — Vue 3 + Vite + TypeScript)

### 6.1 โครงสร้างโปรเจกต์

```
src/
  router/        เส้นทาง 1 หน้า = 1 route + route guard (auth/permission)
  stores/        Pinia: auth, branch, cart, ui (ภาษา/ดาร์กโหมด)
  api/           API client มี type — 1 ไฟล์ต่อ 1 โดเมน (แทน data.js เดิม)
  views/         1 ไฟล์ต่อ 1 หน้า: Dashboard, POS, Stock, Customers, ...
  components/    ใช้ร่วม: modal, form, table, product card
  composables/   ตรรกะใช้ซ้ำ: usePermission, useToast, ...
  i18n/          พจนานุกรม th / en (ย้ายมาจาก demo)
  styles/        port styles.css เดิมมา (เก็บดีไซน์เดิม + ดาร์กโหมด)
```

### 6.2 หลักการ

- **State** — Pinia แทน global `State` เดิม
- **i18n** — vue-i18n ยกพจนานุกรม th/en เดิมมาใช้
- **ดีไซน์** — ไม่ใช้ UI library สำเร็จรูป แต่ port `styles.css` ที่มีอยู่มาประกอบเป็น
  component ให้หน้าตาคงเดิม
- เลิกใช้รูปแบบ `render()` + `attachEvents()` ที่ผูก event ใหม่ทั้งหมดทุกครั้ง —
  ใช้ reactivity ของ Vue จัดการอัปเดต UI
- ทุกข้อมูลโหลดผ่าน API มี loading / error state
- Modal เป็น Vue component (`v-if` + teleport) ไม่สร้าง DOM เอง
- ปัญหา XSS ของ demo (ยัด `innerHTML` ดิบ) หายไปเพราะ Vue escape ข้อความให้อัตโนมัติ
- ปุ่ม/เมนูซ่อนตามสิทธิ์ด้วย `usePermission` — แต่การบังคับจริงอยู่ที่เซิร์ฟเวอร์
  (ฝั่งหน้าบ้านเป็นเรื่อง UX เท่านั้น)

## 7. VAT & ใบกำกับภาษี

- ราคาที่ตั้งในระบบรวม VAT 7% แล้ว — โมดูลคำนวณถอดฐานภาษีและยอด VAT ออกมา
  แล้วเก็บไว้ในบิล (`sales`)
- เอกสารภาษี 2 แบบ:
  - **ใบกำกับภาษีอย่างย่อ** — สำหรับลูกค้าทั่วไป (ค่าเริ่มต้น)
  - **ใบกำกับภาษีเต็มรูป** — เมื่อลูกค้าให้เลขประจำตัวผู้เสียภาษี/ชื่อ/ที่อยู่
    (ระเบียน `customers` มีช่องข้อมูลภาษีเพิ่ม)
- เลขใบกำกับภาษีรันต่อเนื่องแยกรายสาขา ผ่าน `number_sequences`
- ข้อมูลบริษัท (ชื่อ เลขผู้เสียภาษี สำนักงานใหญ่/สาขา) เก็บใน `app_settings`

## 8. ฟีเจอร์ตัดขวาง (Cross-cutting)

### 8.1 พิมพ์เอกสาร
Vue component หน้าพิมพ์แยก + print CSS (`@media print`) → `window.print()`
ครอบคลุม: ใบกำกับภาษี/ใบเสร็จ, ใบเสนอราคา, ใบส่งของ, Z-report

### 8.2 Real-time (SSE)
เซิร์ฟเวอร์ push เหตุการณ์ `sale.completed` / `stock.changed` / `delivery.updated`
ผ่าน Server-Sent Events → Pinia store รับ → รีเฟรชเฉพาะหน้าที่เกี่ยวข้อง
(แทน `BroadcastChannel` ของ demo ที่ซิงก์ได้แค่แท็บในเครื่องเดียวกัน)

### 8.3 รายงานประจำวัน (ส่งจริง)
ตัวตั้งเวลา `node-cron` บนเซิร์ฟเวอร์ → สร้างรายงาน → ส่งผ่าน:
- **Email** — SMTP ผ่าน nodemailer
- **LINE** — LINE Messaging API

token/credentials เก็บใน env ไม่ฝังในโค้ด · บันทึกผลส่งลง `daily_report_history`

### 8.4 ความปลอดภัย
- HTTPS บังคับ; session cookie `httpOnly` + `secure` + `sameSite`
- argon2 hash รหัสผ่าน
- Validate ข้อมูล 2 ฝั่ง — Fastify JSON Schema (เซิร์ฟเวอร์) + ฝั่งหน้าบ้าน
- Rate limiting ที่ endpoint login
- Secret ทั้งหมดอยู่ในไฟล์ `.env` ไม่ commit (รหัส DB, LINE token, SMTP credentials)
- Prisma ป้องกัน SQL injection; Vue ป้องกัน XSS โดยปริยาย

### 8.5 Error handling
API คืน error แบบมีโครงสร้าง (`code` + `message`) · หน้าบ้านแสดง toast และ
จัดการ error/loading state ทุกหน้า

## 9. เทสต์ (Testing)

- **หลังบ้าน** — unit test ตรรกะสำคัญ (คำนวณ VAT, เช็คเอาท์, คืนเงิน, แต้มสะสม,
  RBAC, ออกเลขเอกสาร) + integration test API เทียบกับฐานข้อมูลทดสอบ
- **หน้าบ้าน** — Vitest component test สำหรับ flow สำคัญ (เช็คเอาท์, login)
- E2E test เป็นทางเลือกในอนาคต ไม่อยู่ใน v1

## 10. Deploy & Backup

- Deploy ด้วย Docker Compose; nginx + Let's Encrypt บน VPS
- container ตั้ง restart policy ให้ฟื้นตัวเองเมื่อเครื่อง/process ล่ม
- **Backup** — `pg_dump` อัตโนมัติทุกวัน + คัดลอกออกนอกเครื่อง
- Database migration จัดการด้วย Prisma migrations (มีเวอร์ชัน)
- Seed ข้อมูลตั้งต้น: บทบาท/สิทธิ์, ค่า `app_settings`, บัญชีผู้ดูแลระบบจริง 1 บัญชี

## 11. การย้ายข้อมูล (Data Migration)

ข้อมูลตั้งต้นจริง (สินค้า, ลูกค้า, สต็อก) นำเข้าผ่านฟีเจอร์ Excel import โดยตรวจสอบ
ความถูกต้องฝั่งเซิร์ฟเวอร์ — เป็นช่องทางเดียวกับที่ demo มีอยู่ ไม่ใช้ seed ข้อมูลปลอม
ของ demo ในระบบจริง

## 12. ขอบเขตที่ไม่รวมใน v1 (Out of Scope / YAGNI)

- โหมดออฟไลน์ / offline-first sync
- Multi-tenant / ขายเป็นซอฟต์แวร์ให้ร้านอื่น / ระบบ billing
- เชื่อมต่อฮาร์ดแวร์: สแกนเนอร์บาร์โค้ด, ลิ้นชักเก็บเงิน, เครื่องรูดบัตร/EDC
- สร้าง QR PromptPay / เชื่อม payment gateway — วิธีชำระเงินยังบันทึกด้วยมือเหมือน demo
- แอปมือถือ native
- ระบบ e-Tax Invoice ส่งกรมสรรพากรแบบอิเล็กทรอนิกส์ (ออกเอกสารพิมพ์เท่านั้นใน v1)

## 13. ลำดับการพัฒนา (Implementation Phases — ภาพรวม)

แผนละเอียดจะจัดทำในขั้นตอน writing-plans ต่อไป ภาพรวมลำดับ:

1. **Foundation** — โครงโปรเจกต์, Docker Compose, Postgres, Prisma schema +
   migrations, โครง Fastify, โครง Vue+Vite, ระบบเทสต์, ขั้นตอน deploy ขึ้น VPS
2. **Auth & RBAC** — login, session, บทบาท/สิทธิ์, จัดการผู้ใช้/สาขา
3. **Catalog & Stock** — สินค้า/หมวด/วัสดุโซฟา, สต็อกรายสาขา, โอน/ปรับสต็อก
4. **Customers** — ลูกค้า, แต้มสะสม, ระดับสมาชิก
5. **POS & Sales** — เช็คเอาท์ (transaction), VAT, ใบเสร็จ/ใบกำกับภาษี, พิมพ์
6. **Receipts, Quotations, Outstanding** — คืนเงิน/ยกเลิก, ใบเสนอราคา, ยอดมัดจำ
7. **Delivery** — โซน/ช่องทาง/ทีม/คนขับ, สถานะการจัดส่ง, ปฏิทิน
8. **Reports & Dashboard** — Z-report, รายงานประจำวัน (Email/LINE), Dashboard
9. **Settings, Audit, Import/Export**
10. **Hardening & Go-live** — backup อัตโนมัติ, ตรวจความปลอดภัย, ย้ายข้อมูลจริง,
    เปิดใช้งาน
