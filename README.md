# EasyShop POS

ระบบขายหน้าร้าน (Point of Sale) สำหรับร้านค้าไทย รองรับการชำระเงินผ่าน QR PromptPay

---

## Stack

| ส่วน | เทคโนโลยี |
|------|-----------|
| Framework | Expo ~52 + Expo Router ~4 |
| UI | React Native 0.76, NativeWind (Tailwind) |
| Backend / DB | Supabase (PostgreSQL + Auth + Realtime) |
| State | Zustand v5 + Immer |
| Payment | PromptPay EMV QR (BOT Standard) |
| Language | TypeScript |

---

## โครงสร้างโปรเจกต์

```
QRForPay/
├── app/
│   ├── _layout.tsx          # Root layout + auth guard + new-order banner
│   ├── qr-payment.tsx       # QR payment fullscreen modal (staff)
│   ├── (auth)/
│   │   └── login.tsx        # หน้า login (email/password + Google OAuth)
│   ├── (pos)/               # Staff screens — ต้อง login
│   │   ├── _layout.tsx      # Tab navigator (5 tabs) + realtime subscription
│   │   ├── index.tsx        # Hidden route (href: null)
│   │   ├── dashboard.tsx    # สรุปยอดขาย + กราฟ
│   │   ├── orders.tsx       # ออเดอร์ (active tab + history tab) + บิลรวมโต๊ะ
│   │   ├── products.tsx     # จัดการสินค้า + upload รูป
│   │   ├── tables.tsx       # Grid โต๊ะสด (color-coded by status) + QR ต่อโต๊ะ
│   │   ├── settings.tsx     # ตั้งค่าร้าน, ทีมงาน, dark/light mode
│   │   ├── cart.tsx         # ตะกร้า + ชำระเงิน (hidden tab)
│   │   └── inventory.tsx    # สต๊อกวัตถุดิบ (hidden tab)
│   └── (customer)/          # Customer self-order — ไม่ต้อง login
│       ├── _layout.tsx      # ErrorBoundary เท่านั้น
│       └── customer.tsx     # เมนู → ตะกร้า → ชำระ QR  (URL: /customer)
├── components/
│   ├── ProductCard.tsx
│   ├── CartItem.tsx
│   ├── QRPaymentModal.tsx
│   ├── OrderDetailModal.tsx
│   └── ProductFormModal.tsx
├── src/
│   ├── lib/
│   │   ├── supabase.ts      # Supabase client (+ supabaseCustomer anon)
│   │   ├── qr.ts            # PromptPay EMV payload + CRC16-CCITT
│   │   └── receipt.ts       # Receipt utilities
│   ├── store/
│   │   ├── authStore.ts     # User / Shop / Team / PendingUsers session
│   │   ├── cartStore.ts     # ตะกร้า (persisted) + resumeOrder
│   │   ├── productStore.ts  # Products + Categories
│   │   ├── orderStore.ts    # Orders + Payments + Realtime + History
│   │   └── ingredientStore.ts # วัตถุดิบ + สต๊อก
│   └── types/
│       ├── index.ts         # Business types
│       └── database.ts      # Supabase DB types
├── constants/
│   ├── colors.ts            # Static color palette
│   ├── ThemeContext.tsx     # Light/Dark theme + useTheme()
│   ├── theme.ts             # Design tokens (shadow, radius, space)
│   └── config.ts            # tax rate
├── supabase/
│   ├── schema.sql           # DDL — 10 tables
│   ├── rls_policies.sql     # Row Level Security policies
│   ├── seed.sql             # ข้อมูลตัวอย่าง
│   ├── functions/
│   │   └── notify-payment/  # Edge Function: push notification เมื่อรับโอน
│   └── migrations/          # Migration files (ตามลำดับ timestamp)
├── docs/
│   ├── DEV_GUIDE.md         # คู่มือนักพัฒนาฉบับเต็ม
│   └── CUSTOMER_GUIDE.md    # คู่มือสำหรับลูกค้า/ร้านค้า
└── __tests__/
    ├── cart.test.ts
    ├── qr.test.ts
    ├── order.test.ts
    ├── products.test.ts
    └── TEST_PLAN.md
```

---

## Database Schema

```
shops ──< profiles          (profiles.shop_id → shops.id)
shops ──o profiles          (shops.owner_id → profiles.id, one-to-one)
shops ──< categories ──< products
shops ──< orders ──< order_items >── products
              └──1 payments (payments.order_id UNIQUE)
```

**10 tables:** `shops`, `profiles`, `categories`, `products`, `orders`, `order_items`, `payments`, `ingredients`, `stock_movements`, `recipes`

- PKs ทุกตารางเป็น UUID
- RLS เปิดทุกตาราง — แยกข้อมูลตาม `shop_id`
- Helper functions: `get_my_shop_id()`, `get_my_role()`
- Owners: CRUD ทุกอย่าง | Cashiers: SELECT + INSERT/UPDATE orders & payments
- Super Admin: approve ร้านใหม่, ดู pending users (ไม่ผูกกับ shop_id)

---

## การตั้งค่า

### 1. ติดตั้ง dependencies

```bash
npm install
```

### 2. ตั้งค่า environment variables

สร้างไฟล์ `.env` ที่ root:

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
EXPO_PUBLIC_PROMPTPAY_ID=0812345678
```

### 3. รัน Supabase migrations

```bash
supabase db push   # push migrations ทั้งหมดขึ้น remote
```

หรือรันใน Supabase Dashboard → SQL Editor ตามลำดับ:
```
1. supabase/schema.sql
2. supabase/rls_policies.sql
3. supabase/migrations/ (เรียงตาม timestamp)
4. supabase/seed.sql
```

### 4. Deploy Edge Function (push notifications)

```bash
supabase functions deploy notify-payment --project-ref <ref>
supabase secrets set WEBHOOK_SECRET=<random-hex-64> --project-ref <ref>
```

### 5. รัน app

```bash
npx expo start
```

---

## Payment Flow

```
Cart → [ชำระ QR] → createOrder() → insert orders + order_items + payments
                                          ↓
                              generatePromptPayPayload()
                                          ↓
                              qr-payment screen แสดง QR
                                          ↓
                    Supabase Realtime subscribe payments table
                                          ↓
                         payment.status = 'success' → router → POS
```

### PromptPay EMV Format (BOT Standard)
- Payload ID: `00` = PromptPay
- Phone: แปลง `08x` → `0066x` (ตัดเลข 0 นำหน้า)
- Amount: เข้ารหัส 2 ทศนิยม
- Currency: `764` (THB)
- CRC: CRC16-CCITT XModem (4 hex หลัก)

---

## Tax / Pricing

- VAT 7% **inclusive** (รวมอยู่ในราคาสินค้าแล้ว)
- สูตร: `taxAmount = total × (0.07 / 1.07)`
- Discount คำนวณก่อนแยกภาษี

---

## Roles

| Role | สิทธิ์ |
|------|--------|
| `super_admin` | Approve ร้านค้าใหม่, ดู pending users ทุกร้าน |
| `owner` | CRUD ทุกอย่างในร้านตัวเอง, จัดการทีมงาน |
| `cashier` | ดูสินค้า/หมวดหมู่ + สร้าง/อัพเดตออเดอร์ & payments |
| (pending) | บัญชี Google OAuth ที่ยังรอ approve จาก super_admin |

---

## Tests

```bash
npx jest          # รันครั้งเดียว
npm test          # watch mode
npx jest --coverage  # ดู coverage report
```

- Unit tests: cart, qr, order, products, auth, ingredient, e2e_payment_flow
- Coverage target: 70% branches, 80% functions/lines
- ดูรายละเอียด: [`__tests__/TEST_PLAN.md`](./__tests__/TEST_PLAN.md)

## Push Notifications

เมื่อลูกค้าชำระเงินสำเร็จ (auto detect) พนักงานทุกคนในร้านจะได้รับ push notification ผ่าน Expo:

```
payment.status = 'success' (auto)
    → DB trigger notify_payment_webhook()
    → Edge Function notify-payment
    → Expo Push API
    → พนักงานทุกคนในร้าน
```

- Webhook secret หมุนผ่าน `supabase secrets set WEBHOOK_SECRET=<new>` — **ไม่ commit secret ลง git เด็ดขาด**
- `profiles.push_token` เก็บ Expo push token (ลงทะเบียนอัตโนมัติหลัง login)

---

## Color Scheme

| Token | Hex | ใช้ที่ |
|-------|-----|--------|
| `primary` | `#0066CC` | ปุ่มหลัก, header |
| `secondary` | `#00A651` | ปุ่มชำระเงิน, completed |
| `accent` | `#FF6B00` | badge, highlight |
| `danger` | `#DC2626` | ลบ, cancelled |
| `warning` | `#F59E0B` | pending, สต๊อกต่ำ |
