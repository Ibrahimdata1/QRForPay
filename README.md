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
│   ├── _layout.tsx          # Root layout + auth guard
│   ├── qr-payment.tsx       # QR payment fullscreen modal
│   ├── (auth)/
│   │   └── login.tsx        # หน้า login (Supabase auth)
│   └── (pos)/
│       ├── _layout.tsx      # Tab navigator (3 tabs)
│       ├── index.tsx        # หน้า POS หลัก — เลือกสินค้า
│       ├── cart.tsx         # ตะกร้า + ชำระเงิน
│       ├── orders.tsx       # ประวัติออเดอร์
│       └── products.tsx     # รายการสินค้าทั้งหมด + สต๊อก
├── components/
│   ├── ProductCard.tsx
│   ├── CartItem.tsx
│   ├── QRPaymentModal.tsx
│   ├── CategoryFilter.tsx
│   ├── NumPad.tsx
│   └── OrderSummary.tsx
├── src/
│   ├── lib/
│   │   ├── supabase.ts      # Supabase client
│   │   ├── qr.ts            # PromptPay EMV payload + CRC16-CCITT
│   │   └── receipt.ts       # Receipt utilities
│   ├── store/
│   │   ├── authStore.ts     # User / Shop session
│   │   ├── cartStore.ts     # ตะกร้า (persisted)
│   │   ├── productStore.ts  # Products + Categories
│   │   └── orderStore.ts    # Orders + Payments + Realtime
│   └── types/
│       ├── index.ts         # Business types
│       └── database.ts      # Supabase DB types
├── constants/
│   ├── colors.ts            # Thai POS color scheme
│   └── config.ts            # Supabase URL, PromptPay ID, tax rate
├── supabase/
│   ├── schema.sql           # DDL — 7 tables
│   ├── rls_policies.sql     # Row Level Security policies
│   └── seed.sql             # ข้อมูลตัวอย่าง
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

**7 tables:** `shops`, `profiles`, `categories`, `products`, `orders`, `order_items`, `payments`

- PKs ทุกตารางเป็น UUID
- RLS เปิดทุกตาราง — แยกข้อมูลตาม `shop_id`
- Helper functions: `get_my_shop_id()`, `get_my_role()`
- Owners: CRUD ทุกอย่าง | Cashiers: SELECT + INSERT/UPDATE orders & payments

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

ใน Supabase Dashboard → SQL Editor รันตามลำดับ:

```
1. supabase/schema.sql
2. supabase/rls_policies.sql
3. supabase/seed.sql
```

### 4. รัน app

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
| `owner` | CRUD ทุกอย่างในร้านตัวเอง |
| `cashier` | ดูสินค้า/หมวดหมู่ + สร้าง/อัพเดตออเดอร์ & payments |

---

## Tests

```bash
npx jest          # รันครั้งเดียว
npm test          # watch mode
```

- 43 unit tests ใน 4 ไฟล์
- Coverage target: 70% branches, 80% functions/lines
- ดูรายละเอียด: [`__tests__/TEST_PLAN.md`](./__tests__/TEST_PLAN.md)

---

## Color Scheme

| Token | Hex | ใช้ที่ |
|-------|-----|--------|
| `primary` | `#0066CC` | ปุ่มหลัก, header |
| `secondary` | `#00A651` | ปุ่มชำระเงิน, completed |
| `accent` | `#FF6B00` | badge, highlight |
| `danger` | `#DC2626` | ลบ, cancelled |
| `warning` | `#F59E0B` | pending, สต๊อกต่ำ |
