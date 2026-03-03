# Dev Guide — EasyShop POS

## Setup

```bash
git clone <repo-url> && cd QRForPay
npm install

# สร้าง .env
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...

npx expo start
```

---

## คำสั่งที่ใช้บ่อย

```bash
npx expo start          # รัน dev server
npx jest                # รัน tests (126 tests)
npx jest --coverage     # พร้อม coverage report
supabase db push        # push migration ขึ้น Supabase
supabase functions deploy notify-payment  # deploy Edge Function
```

---

## โครงสร้างโปรเจค

```
app/
  (auth)/login.tsx          # หน้า login
  (pos)/
    index.tsx               # หน้าขาย
    cart.tsx                # ตะกร้า + ชำระเงิน
    orders.tsx              # ประวัติออเดอร์
    products.tsx            # จัดการสินค้า
    dashboard.tsx           # สรุปยอดขาย
  qr-payment.tsx            # หน้า QR modal

components/                 # UI components
src/
  lib/supabase.ts           # Supabase client
  lib/qr.ts                 # PromptPay EMV generator
  store/
    authStore.ts            # user, profile, shop
    cartStore.ts            # ตะกร้า (persisted)
    orderStore.ts           # orders + realtime
    productStore.ts         # สินค้า + categories
    ingredientStore.ts      # วัตถุดิบ
  types/index.ts            # TypeScript interfaces

supabase/migrations/        # Migration files (timestamp_name.sql)
__tests__/                  # Jest tests
.claude/agents/             # Agent definitions
```

---

## Stack

| | |
|-|-|
| **Expo SDK 54** + **Expo Router 6** | File-based routing, React 19 |
| **Supabase** | PostgreSQL + Auth + Realtime + Storage + RLS |
| **Zustand v5** + **Immer** | State management, ไม่มี boilerplate |
| **TypeScript** | ทั้งโปรเจค |

---

## Flow สำคัญ

### QR Payment
```
cart.tsx → createOrder() → INSERT orders+payments
        → navigate qr-payment.tsx
        → subscribeToOrder() [Supabase Realtime]
        → ลูกค้าสแกน QR จ่ายเงิน
        → กดปุ่ม "ยืนยันรับเงินแล้ว" (manual confirm)
        → completeOrder() → clearCart() → navigate home
```

> **หมายเหตุ**: Auto-confirm ยังไม่เชื่อมธนาคารจริง — cashier ต้องกดยืนยันเสมอ
> อนาคต: สามารถเชื่อม EasySlip (easyslip.app) สำหรับ verify slip อัตโนมัติ

### Cash Payment
```
cart.tsx → เลือก "เงินสด" → กรอกเงินที่รับมา
        → createOrder() → completeOrder() ทันที
        → clearCart() → navigate orders
```

### VAT (Inclusive)
```
effectiveTotal = subtotal - discount       ← ยอดที่ลูกค้าจ่าย
taxAmount      = effectiveTotal × (0.07/1.07)  ← VAT ที่รวมอยู่แล้ว
```

---

## UX Requirements (ห้ามละเมิด)

| # | กฎ |
|---|-----|
| R-UX-01 | ข้อความทุกจุดต้องเป็นภาษาไทย ห้ามมีอังกฤษปน |
| R-UX-02 | วันที่ต้องใช้ `calendar: 'gregory'` ป้องกัน "69" (พ.ศ. 2 หลัก) |
| R-UX-03 | Element ที่กดได้ต้องมี border/background ชัดเจน |
| R-UX-04 | Error states ต้องแสดง banner เสมอ ห้าม silent fail |

---

## เพิ่ม Feature ใหม่

```
1. supabase/migrations/<timestamp>_<name>.sql  → supabase db push
2. src/types/index.ts                          → เพิ่ม interface
3. src/store/                                  → เพิ่ม action
4. app/(pos)/ หรือ components/                 → เพิ่ม UI
5. __tests__/                                  → เขียน test
6. npx jest                                    → ต้องผ่านทุก test
```

---

## Agents

| Agent | ใช้เมื่อ |
|-------|---------|
| **dev** | implement feature, แก้ bug |
| **qa** | ตรวจ logic, เขียน test |
| **security** | audit RLS, auth flow |
| **customer** | ทดสอบ UX บน simulator (screenshot จริงเท่านั้น) |
| **uxui** | ออกแบบ UI |
| **cto** | วางแผน, assign งาน, สรุปผล |

**Pipeline**: `cto → dev → qa → customer → cto`

---

## Environment Variables

| ตัวแปร | หมายเหตุ |
|--------|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | URL project Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | anon key (public ได้) |

Service role key → ใช้ใน Edge Functions เท่านั้น ห้ามใส่ client code

---

## Tests (126 tests, 7 files)

```bash
npx jest                        # รันครั้งเดียว
npx jest --watchAll             # watch mode
npx jest __tests__/cart.test.ts # รัน 1 ไฟล์
```

Coverage target: 70% branches / 80% functions+lines
