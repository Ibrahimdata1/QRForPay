# Dev Guide — EasyShop POS

## UX Requirements (จาก Customer Testing — 2026-03-04)

### R-UX-01: ข้อความทุกจุดต้องเป็นภาษาไทย
- Empty state ทุกหน้าต้องเป็นภาษาไทยเท่านั้น ห้ามมีภาษาอังกฤษปน
- Label สำคัญเช่น "PromptPay ID" ควรมี subtitle ภาษาไทยอธิบาย
- **ไฟล์**: `app/(pos)/products.tsx` — empty state "No products found" → แก้เป็น "ยังไม่มีสินค้า"

### R-UX-02: วันที่ต้องแสดงชัดเจน ไม่งง
- รูปแบบวันที่ในแอพต้องไม่แสดง "69" (ปี พ.ศ. 2 หลัก) เพราะดูผิดพลาด
- ใช้ปี ค.ศ. เต็ม หรือ พ.ศ. เต็ม (2569) ไม่ใช่ย่อ
- **ไฟล์**: `app/(pos)/orders.tsx`, `components/OrderDetailModal.tsx` — formatDateTime

### R-UX-03: ปุ่ม Interactive ต้องดูกดได้ชัดเจน
- Element ที่กดได้ต้องมี visual cue ชัดเจน (border, background, shadow)
- ปุ่ม "เพิ่มส่วนลด" ใน cart ต้องดูเหมือนปุ่ม ไม่ใช่แค่ text label
- **ไฟล์**: `app/(pos)/cart.tsx` — discountRow style

### R-UX-04: Error States ต้องแจ้ง user เสมอ ห้าม silent fail
- ถ้าโหลดข้อมูลไม่ได้ ต้องแสดงข้อความแจ้ง ห้ามแสดงเป็น 0 หรือว่างเปล่าโดยไม่บอกสาเหตุ
- **ไฟล์**: `app/(pos)/dashboard.tsx` — ถ้า fetch error ให้แสดง error state แทนค่า 0

---

## แอพนี้คืออะไร

EasyShop POS คือแอพ Point-of-Sale สำหรับร้านค้าไทย สร้างด้วย React Native + Expo รองรับทั้ง iOS และ Android รองรับการรับชำระเงินผ่าน PromptPay QR (มาตรฐาน EMV ของ BOT) โดยที่ QR สร้างในแอพฝั่ง client เลย ไม่ต้องผ่าน payment gateway ภายนอก ระบบรองรับหลายร้าน (multi-tenant) แต่ละร้านแยกข้อมูลกันด้วย Supabase RLS มี role สองแบบคือ owner (เจ้าของร้าน) กับ cashier (แคชเชียร์)

---

## Setup เร็วๆ

```bash
# 1. Clone และติดตั้ง dependency
git clone <repo-url>
cd QRForPay
npm install

# 2. สร้าง .env ที่ root
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
EXPO_PUBLIC_PROMPTPAY_ID=0812345678   # เบอร์โทรหรือเลขนิติบุคคล 13 หลัก

# 3. รัน
npx expo start
```

### คำสั่งที่ใช้บ่อย

```bash
# รัน dev server
npx expo start

# รัน tests (watch mode)
npx jest --watchAll

# รัน tests ครั้งเดียวพร้อม coverage
npx jest --coverage

# Push schema ขึ้น Supabase
supabase db push

# Deploy Edge Function
supabase functions deploy notify-payment

# รัน migration เฉพาะไฟล์
psql $DATABASE_URL -f supabase/migrations/<filename>.sql
```

> **หมายเหตุ**: push notification ใช้งานได้บนอุปรณ์จริงเท่านั้น ไม่ทำงานใน simulator

---

## โครงสร้างโฟลเดอร์

```
QRForPay/
├── app/                    # หน้าจอทั้งหมด (Expo Router file-based routing)
│   ├── _layout.tsx         # Root layout: จัดการ session + redirect
│   ├── (auth)/             # Group: หน้าก่อน login
│   │   └── login.tsx       # หน้า login
│   └── (pos)/              # Group: หน้าหลังจาก login แล้ว
│       ├── _layout.tsx     # Tab navigator (POS / Orders / Products / Inventory)
│       ├── index.tsx       # หน้าขาย — เลือกสินค้าใส่ตะกร้า
│       ├── cart.tsx        # ตะกร้า + ชำระเงิน
│       ├── orders.tsx      # ประวัติออเดอร์
│       ├── products.tsx    # จัดการสินค้า (owner เท่านั้น)
│       └── inventory.tsx   # จัดการวัตถุดิบ (ingredients)
│
├── components/             # Reusable UI components
│   ├── ProductCard.tsx     # การ์ดสินค้าในหน้าขาย
│   ├── CartItem.tsx        # รายการในตะกร้า
│   ├── QRPaymentModal.tsx  # Modal แสดง QR + รอ confirm
│   ├── OrderDetailModal.tsx # Modal ดูรายละเอียดออเดอร์
│   ├── ProductFormModal.tsx # Form เพิ่ม/แก้ไขสินค้า
│   ├── CategoryFilter.tsx  # Filter หมวดหมู่สินค้า
│   └── IngredientFormModal.tsx # Form เพิ่ม/แก้ไขวัตถุดิบ
│
├── src/
│   ├── lib/
│   │   ├── supabase.ts     # Supabase client instance
│   │   └── qr.ts           # PromptPay EMV payload generator + CRC16
│   ├── store/              # Zustand stores (state management)
│   │   ├── authStore.ts    # user, profile, shop + push token
│   │   ├── cartStore.ts    # ตะกร้าสินค้า (persisted)
│   │   ├── orderStore.ts   # สร้าง/ดึง/subscribe ออเดอร์
│   │   ├── productStore.ts # สินค้าและหมวดหมู่
│   │   └── ingredientStore.ts # วัตถุดิบ + การตัดสต็อก
│   └── types/
│       └── index.ts        # TypeScript interfaces ทั้งหมด
│
├── constants/
│   ├── colors.ts           # Design system colors
│   └── config.ts           # ค่า config (tax rate, PromptPay ID, timeout)
│
├── supabase/
│   ├── schema.sql          # DDL ตารางทั้งหมด
│   ├── seed.sql            # ข้อมูลตัวอย่าง
│   ├── rls_policies.sql    # Row Level Security policies
│   └── migrations/         # Migration files เรียงตามเวลา
│
├── __tests__/              # Test files (Jest)
├── .claude/agents/         # Agent definitions สำหรับ Claude Code
└── docs/                   # เอกสาร project นี้
```

---

## Stack ที่ใช้ + ทำไมถึงเลือก

| Library | Version | ทำไม |
|---------|---------|-------|
| **Expo** | ~52 | ไม่ต้อง eject ออก bare RN, จัดการ native modules ให้ผ่าน config plugins |
| **Expo Router** | ~4 | File-based routing เหมือน Next.js — โฟลเดอร์ = route, ไม่ต้องเขียน navigator มือ |
| **Supabase** | ^2.45 | PostgreSQL + Auth + Realtime + Storage ในที่เดียว, RLS ทำ multi-tenant ได้ง่าย |
| **Zustand v5** | ^5.0 | State ง่ายกว่า Redux มาก ไม่มี boilerplate, selector pattern ป้องกัน re-render ฟุ่มเฟือย |
| **Immer** | ^10.1 | middleware ให้ Zustand — เขียน mutation แบบ mutable ได้ ไม่ต้อง spread ลึกๆ |
| **NativeWind** | ^4.0 | Tailwind CSS บน React Native — จัด style เร็วกว่า StyleSheet สำหรับ layout ง่ายๆ |
| **react-native-qrcode-svg** | ^6.3 | render QR code จาก EMV string เป็น SVG บน device |
| **AsyncStorage** | 2.1.0 | ใช้ persist cartStore — ตะกร้าไม่หายเมื่อปิดแอพ |

---

## Flow สำคัญ

### การชำระเงิน QR

```
หน้าขาย (index.tsx)
  └── กดเพิ่มสินค้า → cartStore.addItem()

หน้าตะกร้า (cart.tsx)
  └── กด "ชำระเงิน QR"
        ↓
  orderStore.createOrder(shopId, cashierId, items, 'qr', discount, taxRate)
        ↓ (Supabase INSERT)
  สร้าง orders + order_items + payments rows
  qr_payload = generatePromptPayPayload(promptPayId, totalAmount)
        ↓
  เปิด QRPaymentModal
        ↓
  orderStore.subscribeToOrder(orderId)
  [Supabase Realtime — listen payments UPDATE]
        ↓
  ลูกค้าสแกน QR จ่ายเงิน
        ↓
  Webhook/Bank อัพเดต payments.status = 'success'
        ↓  (Realtime event มาถึงแอพ)
  ถ้า confirmation_type ว่าง → auto-confirm
    → completeOrder(orderId, payment, 'auto')
  ถ้ากด "ยืนยันรับเงินแล้ว" → manual-confirm
    → completeOrder(orderId, payment, 'manual', profile.id)
        ↓
  orders.status = 'completed', cartStore.clearCart()
```

**ทำไม auto vs manual?** — บางครั้ง webhook ธนาคารอาจช้า หรือ sandbox ไม่ส่ง event มา cashier ยืนยันเองได้เสมอ โดย badge สีจะบอกว่า confirm แบบไหน (สีส้ม = manual, สีน้ำเงิน = auto)

### การคำนวณราคา

VAT ของไทยเป็นแบบ **inclusive** (รวมอยู่ในราคาสินค้าแล้ว) ดังนั้นสูตรจึงเป็น:

```
subtotal     = ผลรวม item.subtotal ทุกชิ้น
discountAmt  = subtotal × (discount% / 100)
effectiveTotal = subtotal - discountAmt   ← นี่คือยอดที่ลูกค้าจ่ายจริง

// VAT display (แสดงให้รู้ว่า VAT ในนั้นเท่าไหร่)
taxAmount = effectiveTotal × (taxRate / (1 + taxRate))
// เช่น ราคา 107 บาท → VAT = 107 × (0.07/1.07) ≈ 7 บาท
```

**ทำไมแบบนี้?** — ราคาสินค้าในร้านไทยส่วนใหญ่รวม VAT แล้ว การบอกว่า "VAT ในนั้น X บาท" ถูกต้องตามกฎหมาย ไม่ต้องบวกเพิ่มอีก

```typescript
// cartStore.ts — selectors
export const selectSubtotal = (state) =>
  state.items.reduce((sum, item) => sum + item.subtotal, 0)

export const selectGrandTotal = (state) => {
  const subtotal = selectSubtotal(state)
  const discountAmount = selectDiscountAmount(state)
  return subtotal - discountAmount  // total = subtotal - discount (VAT inclusive)
}
```

### Multi-tenant isolation

ทุกตารางมีคอลัมน์ `shop_id` และ Supabase RLS จะ block request ที่ข้ามร้านอัตโนมัติ

```sql
-- ตัวอย่าง RLS policy สำหรับ products
CREATE POLICY "products_shop_isolation" ON products
  USING (shop_id = get_my_shop_id());

-- Helper function ดึง shop_id จาก JWT
CREATE FUNCTION get_my_shop_id() RETURNS UUID AS $$
  SELECT shop_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;
```

**ทำไม?** — แม้จะใช้ anon key เดียวกัน ผู้ใช้จากร้าน A จะไม่สามารถ query ข้อมูลร้าน B ได้เลย ไม่ต้องเขียน WHERE shop_id = ? ในทุก query ฝั่ง client (แต่เขียนก็ดี เพื่อ performance)

---

## Stores (Zustand)

Stores ทุกตัวใช้ `immer` middleware — แปลว่าใน `set()` เขียน mutation ตรงๆ ได้เลย Immer จะสร้าง immutable state ใหม่ให้

### authStore

เก็บ `user`, `profile`, `shop` หลัง login ข้อมูลพวกนี้ใช้ทั่วแอพ เช่น `profile.shop_id` สำหรับ query Supabase

```typescript
// ใช้ใน screen
const { profile, shop, signIn, signOut } = useAuthStore()
```

- `initialize()` — เรียกที่ root layout, ดึง session จาก AsyncStorage + fetch profile/shop
- `registerPushToken()` — เรียกหลัง login/initialize แบบ best-effort (ไม่ blocking)

### cartStore (persisted)

เก็บสินค้าในตะกร้า persist ด้วย AsyncStorage คนเดียวที่ persist เพราะถ้าปิดแอพระหว่างขายไม่ควรหายหาย

```typescript
// ใช้ selector แยก ไม่ subscribe ทั้ง state เพื่อกัน re-render
const items = useCartStore((s) => s.items)
const total = useCartStore(selectGrandTotal)
```

Selectors ถูก export แยกใน `cartStore.ts`:
- `selectSubtotal` — ผลรวมก่อนหักส่วนลด
- `selectDiscountAmount` — ยอดส่วนลด
- `selectTaxAmount` — VAT ที่รวมในราคาแล้ว (แสดง info เท่านั้น)
- `selectGrandTotal` — ยอดที่ลูกค้าจ่ายจริง
- `selectItemCount` — จำนวนชิ้นทั้งหมด (สำหรับ badge บน tab)

### orderStore

ไม่ได้ persist — โหลดใหม่ทุกครั้งที่เปิดหน้า orders

- `createOrder()` — INSERT orders + order_items + payments ใน transaction-like sequence
- `completeOrder()` — UPDATE payments.status + orders.status พร้อมบันทึก confirmation_type
- `subscribeToOrder()` — Supabase Realtime listener คืน unsubscribe function
- `fetchOrders()` — ดึง 50 ออเดอร์ล่าสุด พร้อม join items + payment + confirmedByProfile

### productStore

- `fetchProducts()` — ดึงเฉพาะสินค้า `is_active = true`
- `saveProduct()` — ถ้ามี `id` = update, ถ้าไม่มี = insert
- `deleteProduct()` — soft delete: `is_active = false` + `deleted_at = now()`
- `deductStock()` — ลด stock ใน local state (optimistic, ไม่ได้ sync DB ทันที)
- `selectFilteredProducts` — selector filter ตาม category + search query

### ingredientStore

จัดการวัตถุดิบและการตัดสต็อกอัตโนมัติเมื่อมีการขาย

- `adjustStock()` — เรียก Supabase RPC `adjust_stock` (atomic, ป้องกัน race condition)
- `deductForOrder()` — อ่าน recipes ของแต่ละสินค้าในตะกร้า แล้วตัดสต็อกทุกวัตถุดิบพร้อมกัน

**ทำไมใช้ RPC ไม่ใช่ UPDATE ตรงๆ?** — ถ้าสองคนกด confirm พร้อมกัน การ read-then-write จะทำให้ stock ผิด RPC ใน PostgreSQL ทำ atomic transaction ให้

---

## การเพิ่ม Feature ใหม่

Checklist สำหรับ feature ทั่วไป:

```
[ ] 1. สร้าง migration SQL ใน supabase/migrations/<timestamp>_<name>.sql
       - ADD COLUMN / CREATE TABLE / CREATE INDEX
       - รัน: psql $DATABASE_URL -f supabase/migrations/<filename>.sql

[ ] 2. เพิ่ม type ใน src/types/index.ts
       - interface ใหม่ หรือเพิ่ม field ใน interface เดิม

[ ] 3. เพิ่ม/แก้ store ใน src/store/
       - เพิ่ม action ใน interface
       - implement ใน immer set()
       - เพิ่ม selector ถ้าจำเป็น

[ ] 4. สร้าง/แก้ screen ใน app/(pos)/
       - ถ้าเป็นหน้าใหม่ สร้างไฟล์ใน app/(pos)/<name>.tsx
       - เพิ่ม tab ใน app/(pos)/_layout.tsx ถ้าต้องการ

[ ] 5. สร้าง/แก้ component ใน components/
       - ถ้า UI ซับซ้อนหรือใช้ซ้ำหลายที่

[ ] 6. เพิ่ม RLS policy ใน supabase/rls_policies.sql
       - ตาราง/คอลัมน์ใหม่ต้องมี policy เสมอ

[ ] 7. เขียน test ใน __tests__/
       - unit test สำหรับ store action หรือ util function
       - รัน npx jest เพื่อตรวจว่าไม่มี regression
```

**ตัวอย่าง**: เพิ่มฟีเจอร์ "loyalty points"
1. Migration: `ALTER TABLE profiles ADD COLUMN points INT DEFAULT 0`
2. Type: เพิ่ม `points: number` ใน `Profile` interface
3. Store: เพิ่ม `addPoints(userId, amount)` ใน authStore
4. UI: แสดง points ใน cart.tsx หลัง checkout
5. RLS: cashier UPDATE profiles (points เท่านั้น)
6. Test: ตรวจ `addPoints(5)` แล้ว state เปลี่ยนถูกต้อง

---

## Agents ที่มีในโปรเจค

โปรเจคนี้มี Claude agents ที่กำหนดไว้ใน `.claude/agents/` เพื่อให้แต่ละ agent มีบริบทและหน้าที่ชัดเจน ลด token waste

| Agent | ไฟล์ | ใช้เมื่อ |
|-------|------|---------|
| **dev** | `dev.md` | เพิ่ม feature, แก้ bug, refactor — มองภาพรวม architecture |
| **uxui** | `uxui.md` | ออกแบบ/ปรับ UI, ตรวจ flow cashier, ตรวจ accessibility |
| **qa** | `qa.md` | เขียน test, หา edge case, ตรวจ coverage |
| **security** | `security.md` | audit RLS, ตรวจ secret exposure, ตรวจ auth flow |
| **customer** | `customer.md` | ทดสอบ UX ในมุมมองแคชเชียร์ไทยที่ไม่มี tech background |
| **cto** | `cto.md` | วางแผนงาน, แบ่ง task ให้ agents, รับ bug report จาก customer แล้ว assign fix |

**Pipeline ปกติ**:
```
cto → customer → dev/uxui → qa → customer (re-test) → cto (สรุป)
```

ถ้า Claude ถามว่าจะให้ใคร handle — ดูตารางนี้ก็พอ หรือเรียก `cto` ให้ช่วย plan

---

## Tests

### วิธีรัน

```bash
# Watch mode (ระหว่าง develop)
npx jest --watchAll

# รันครั้งเดียว
npx jest

# พร้อม coverage report
npx jest --coverage

# รัน test ไฟล์เดียว
npx jest __tests__/cart.test.ts
```

### Coverage Target

ตาม `jest.config.js`:

| Metric | Target |
|--------|--------|
| Branches | 70% |
| Functions | 80% |
| Lines | 80% |
| Statements | 80% |

Coverage collect จาก `src/**/*.{ts,tsx}` เท่านั้น (ไม่รวม components หรือ screens)

### Pattern การ Mock Supabase

```typescript
// __tests__/order.test.ts — ตัวอย่าง pattern
jest.mock('../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: 'mock-id', status: 'pending' },
        error: null,
      }),
      eq: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
    })),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis(),
      unsubscribe: jest.fn(),
    })),
  },
}))
```

**ทำไม mock Supabase?** — test ไม่ควรต่อ network จริง เพราะช้า, ต้อง auth, และ flaky ถ้า network ขัดข้อง mock ให้ควบคุม response ได้ 100%

### Test files ที่มี

| ไฟล์ | ครอบคลุมอะไร |
|------|------------|
| `cart.test.ts` | cartStore actions, selectors, VAT calculation |
| `qr.test.ts` | EMV payload format, CRC16, edge cases (amount=0, >999999) |
| `order.test.ts` | createOrder, completeOrder, subscribeToOrder |
| `products.test.ts` | productStore, selectFilteredProducts |
| `e2e_payment_flow.test.ts` | flow เต็ม cart → order → QR → confirm |

---

## Deployment

### 1. Database schema

```bash
# Push schema ใหม่ (dev → staging)
supabase db push

# หรือรัน migration ตรงๆ
psql $DATABASE_URL -f supabase/migrations/20260303110000_inventory_schema.sql
```

### 2. Edge Functions

```bash
# Deploy Edge Function (notify-payment webhook handler)
supabase functions deploy notify-payment

# ดู logs
supabase functions logs notify-payment
```

### 3. Supabase Webhook Setup

สำหรับ auto-confirm payment ผ่าน push notification:

1. ไปที่ Supabase Dashboard → Database → Webhooks
2. สร้าง Webhook ใหม่:
   - Table: `payments`
   - Events: `UPDATE`
   - URL: `https://<project-ref>.supabase.co/functions/v1/notify-payment`
   - HTTP Headers: `Authorization: Bearer <service_role_key>`

### 4. Build สำหรับ production

```bash
# iOS
npx expo build:ios
# หรือ EAS Build
eas build --platform ios

# Android
eas build --platform android
```

> อย่าลืม set `EXPO_PUBLIC_*` env vars ใน EAS ด้วย (`eas secret:create`)

### Environment Variables สรุป

| ตัวแปร | ใช้ที่ | หมายเหตุ |
|--------|-------|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | supabase.ts | URL project Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | supabase.ts | anon key (public ได้) |
| `EXPO_PUBLIC_PROMPTPAY_ID` | config.ts | เบอร์โทรหรือเลขนิติบุคคล |

Service role key ใช้ใน Edge Functions เท่านั้น ห้ามใส่ใน client code เด็ดขาด
