# Dev Guide — EasyShop POS
> คู่มือสำหรับนักพัฒนา — เขียนให้มือใหม่ที่ย้ายสายอ่านแล้วเข้าใจได้เลย

---

## แอพนี้คืออะไร?

**EasyShop POS** คือแอพขายของหน้าร้านสำหรับร้านค้าไทย รองรับทั้ง iOS และ Android
ลูกค้าจ่ายผ่าน PromptPay QR หรือเงินสด แคชเชียร์กดยืนยัน — จบ

**Multi-tenant**: แอพเดียวรองรับหลายร้านได้พร้อมกัน ข้อมูลแต่ละร้านแยกกันสนิท
**ไม่มี payment gateway**: QR สร้างในแอพเลย ไม่ต้องจ่ายค่า transaction ให้ใคร

---

## Tech Stack — อ่านตรงนี้ก่อนแตะโค้ด

| เครื่องมือ | ใช้ทำอะไร | ทำไมถึงเลือก |
|-----------|----------|--------------|
| **React Native + Expo SDK 54** | สร้าง UI รันบน iOS/Android | เขียนโค้ดชุดเดียว ได้ทั้ง 2 platform |
| **Expo Router 6** | จัดการ "หน้า" ของแอพ | ตั้งชื่อไฟล์ = ตั้งชื่อ URL เหมือน Next.js |
| **TypeScript** | ทุกไฟล์ใน project นี้ | ป้องกัน bug จาก type ผิด |
| **Supabase** | Database + Auth + Storage + Realtime | PostgreSQL บน cloud ฟรีใช้ได้เลย |
| **Zustand v5** | เก็บ state ของแอพ | ง่ายกว่า Redux มาก ไม่มี boilerplate |
| **Immer** | ใช้คู่กับ Zustand | เขียนแก้ state ตรงๆ ได้ โดยไม่ต้อง spread |
| **NativeWind** | Style ด้วย Tailwind CSS | เขียน style เร็ว แต่ project นี้ใช้ StyleSheet เป็นหลัก |

---

## Setup — เริ่มต้นจาก 0

### สิ่งที่ต้องมีก่อน
- **Node.js** v18+ (ดาวน์โหลดที่ nodejs.org)
- **Xcode** (ถ้าจะรันบน iOS Simulator — Mac เท่านั้น)
- **Android Studio** (ถ้าจะรันบน Android Emulator)
- **บัญชี Supabase** ฟรีที่ supabase.com

### ขั้นตอน

```bash
# 1. โหลดโค้ดมา
git clone https://github.com/Ibrahimdata1/QRForPay.git
cd QRForPay

# 2. ติดตั้ง dependencies (library ทั้งหมด)
npm install

# 3. สร้างไฟล์ .env ที่ root folder
# (copy ค่าจาก Supabase Dashboard → Settings → API)
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# 4. รัน!
npx expo start
```

> **หมายเหตุ**: ไฟล์ `.env` ห้าม commit ขึ้น Git เด็ดขาด — มี `.gitignore` ป้องกันแล้ว

### รันบน Simulator/Emulator
```bash
npx expo start --ios      # เปิดบน iPhone Simulator
npx expo start --android  # เปิดบน Android Emulator
npx expo start --tunnel   # เปิดผ่านอินเทอร์เน็ต (ให้เพื่อนทดสอบได้)
```

---

## โครงสร้างโฟลเดอร์ — มีอะไรอยู่ตรงไหน

```
QRForPay/
│
├── app/                          ← หน้าจอทั้งหมด (Expo Router จัดการ routing)
│   ├── _layout.tsx               ← Root: ตรวจ login แล้วส่งไปหน้าที่ถูก
│   ├── (auth)/
│   │   └── login.tsx             ← หน้า login
│   ├── (pos)/                    ← ทุกหน้าหลังล็อกอิน
│   │   ├── _layout.tsx           ← แถบ tab ด้านล่าง 5 แท็บ
│   │   ├── index.tsx             ← หน้าขาย (เลือกสินค้า)
│   │   ├── cart.tsx              ← ตะกร้า + ชำระเงิน
│   │   ├── orders.tsx            ← ประวัติออเดอร์
│   │   ├── products.tsx          ← จัดการสินค้า
│   │   └── dashboard.tsx         ← สรุปยอดขาย
│   └── qr-payment.tsx            ← หน้าแสดง QR รอจ่ายเงิน
│
├── components/                   ← UI ที่ใช้ซ้ำหลายหน้า
│   ├── ProductCard.tsx           ← การ์ดสินค้าในหน้าขาย
│   ├── CartItem.tsx              ← รายการในตะกร้า
│   ├── QRPaymentModal.tsx        ← Modal แสดง QR + รอยืนยัน
│   ├── OrderDetailModal.tsx      ← Modal รายละเอียดออเดอร์
│   └── ProductFormModal.tsx      ← Form เพิ่ม/แก้ไขสินค้า
│
├── src/
│   ├── lib/
│   │   ├── supabase.ts           ← สร้าง Supabase client (ใช้ทั่วแอพ)
│   │   └── qr.ts                 ← สร้าง PromptPay QR string (EMV standard)
│   ├── store/                    ← State management (Zustand)
│   │   ├── authStore.ts          ← เก็บข้อมูล user ที่ล็อกอินอยู่
│   │   ├── cartStore.ts          ← เก็บสินค้าในตะกร้า
│   │   ├── orderStore.ts         ← สร้าง/ดึง/ติดตามออเดอร์
│   │   ├── productStore.ts       ← รายการสินค้าและหมวดหมู่
│   │   └── ingredientStore.ts    ← วัตถุดิบและสต๊อก
│   └── types/
│       └── index.ts              ← TypeScript types ทั้งหมดในโปรเจค
│
├── constants/
│   ├── colors.ts                 ← สีทั้งหมดของแอพ (เปลี่ยนธีมที่นี่)
│   └── config.ts                 ← ค่า config เช่น tax rate
│
├── supabase/
│   ├── schema.sql                ← สร้างตาราง DB ทั้งหมด
│   ├── rls_policies.sql          ← กฎความปลอดภัย (ใครเข้าถึงข้อมูลอะไรได้)
│   └── migrations/               ← การเปลี่ยนแปลง DB แต่ละครั้ง
│       └── YYYYMMDDHHMMSS_ชื่อ.sql
│
├── __tests__/                    ← Test files (Jest)
├── .claude/agents/               ← AI Agent definitions
├── docs/                         ← เอกสารโปรเจค
└── .env                          ← ⚠️ Secret keys — ห้าม commit!
```

---

## ทำความเข้าใจ Routing

Expo Router ใช้ **ชื่อไฟล์เป็น URL** — ไม่ต้องลงทะเบียน route ที่ไหนทั้งนั้น

```
app/login.tsx           →  /login
app/(pos)/index.tsx     →  /(pos)   (หน้าหลักของกลุ่ม)
app/(pos)/cart.tsx      →  /(pos)/cart
app/(pos)/orders.tsx    →  /(pos)/orders
app/qr-payment.tsx      →  /qr-payment
```

วงเล็บ `(pos)` หมายความว่า "group" — ชื่อ folder ไม่ปรากฏใน URL แต่แชร์ layout เดียวกัน (แถบ tab ด้านล่าง)

**การ navigate ระหว่างหน้า:**
```typescript
import { router } from 'expo-router'

router.push('/qr-payment')          // ไปหน้าใหม่ (กลับได้)
router.replace('/(pos)')            // ไปหน้าใหม่แล้วลบหน้าเก่าออก (กลับไม่ได้)
router.back()                       // กลับหน้าก่อนหน้า
```

---

## ทำความเข้าใจ State Management (Zustand)

State คือ "ข้อมูลที่แอพเก็บไว้ขณะรัน" เช่น สินค้าในตะกร้า, ข้อมูล user ที่ล็อกอิน

**วิธีใช้ Store ใน component:**
```typescript
// ดึงแค่ field ที่ต้องการ — component จะ re-render เฉพาะเมื่อ field นั้นเปลี่ยน
const items = useCartStore((s) => s.items)
const addItem = useCartStore((s) => s.addItem)

// ใช้ selector สำหรับค่าที่ต้องคำนวณ
const total = useCartStore(selectGrandTotal)
```

**วิธีแก้ State (Immer):**
```typescript
// ใน store สามารถแก้ state ตรงๆ ได้เลย — Immer จัดการ immutability ให้
set((state) => {
  state.items.push(newItem)        // แก้ตรงๆ ได้เลย ไม่ต้อง [...state.items, newItem]
  state.discount = 10
})
```

**Stores ที่มี:**

| Store | เก็บอะไร | Persist? |
|-------|---------|---------|
| `authStore` | user, profile, shop หลัง login | ❌ |
| `cartStore` | สินค้าในตะกร้า, discount | ✅ (ไม่หายเมื่อปิดแอพ) |
| `orderStore` | รายการออเดอร์, currentOrder | ❌ |
| `productStore` | รายการสินค้า, categories | ❌ |
| `ingredientStore` | วัตถุดิบ, สต๊อก | ❌ |

---

## ทำความเข้าใจ Supabase

Supabase คือ backend สำเร็จรูปที่ให้:
- **Database** (PostgreSQL) — เก็บข้อมูลทั้งหมด
- **Auth** — จัดการ login/logout
- **Storage** — เก็บไฟล์/รูปภาพ
- **Realtime** — รับ event เมื่อข้อมูลใน DB เปลี่ยน (ใช้ตรวจจับการจ่ายเงิน)

**วิธีใช้ใน code:**
```typescript
import { supabase } from '../src/lib/supabase'

// ดึงข้อมูล
const { data, error } = await supabase
  .from('products')
  .select('*')
  .eq('shop_id', shopId)

// เพิ่มข้อมูล
const { data, error } = await supabase
  .from('orders')
  .insert({ shop_id: shopId, status: 'pending' })
  .select()
  .single()

// อัปเดต
const { error } = await supabase
  .from('payments')
  .update({ status: 'success' })
  .eq('id', paymentId)
```

**RLS (Row Level Security)** คือกฎที่ทำให้ผู้ใช้เห็นได้แค่ข้อมูลของร้านตัวเอง
ถึงแม้ query ไม่ใส่ `WHERE shop_id = ?` Supabase ก็จะ block ข้อมูลร้านอื่นให้อัตโนมัติ

---

## Flow การชำระเงิน — อ่านตรงนี้สำคัญมาก

### QR PromptPay

```
1. แคชเชียร์กด "ชำระเงิน QR" ใน cart.tsx
         ↓
2. createOrder() — INSERT ลง DB:
   - ตาราง orders     (สถานะ: pending)
   - ตาราง order_items (รายการสินค้า)
   - ตาราง payments   (สถานะ: pending, เก็บ QR string)
         ↓
3. แอพ navigate ไป qr-payment.tsx พร้อม orderId
         ↓
4. subscribeToOrder() — ฟัง Realtime ถ้า payment เปลี่ยน
         ↓
5. ส่งมือถือให้ลูกค้าสแกน QR → ลูกค้าโอนเงินผ่านธนาคาร
         ↓
6. แคชเชียร์กดปุ่ม "ยืนยันรับเงินแล้ว" (manual confirm)
         ↓
7. completeOrder() — UPDATE:
   - payments.status = 'success', confirmation_type = 'manual'
   - orders.status = 'completed'
         ↓
8. clearCart() → navigate กลับหน้าขาย
```

> **ทำไมต้องกดยืนยันเอง?** เพราะยังไม่ได้เชื่อมธนาคารโดยตรง
> ถ้าเชื่อม EasySlip ในอนาคต ระบบจะ confirm อัตโนมัติเมื่อลูกค้าสแกน

### เงินสด

```
1. แคชเชียร์กรอกเงินที่รับมา → กด "ชำระเงิน"
         ↓
2. createOrder() → completeOrder() ทันที (ไม่รอยืนยัน)
         ↓
3. clearCart() → navigate หน้าออเดอร์
```

### การคำนวณราคา (VAT Inclusive)

ราคาสินค้าไทยส่วนใหญ่ **รวม VAT อยู่แล้ว** จึงคำนวณแบบนี้:

```
ยอดรวม = ผลรวมสินค้าทุกชิ้น
ส่วนลด = ยอดรวม × (% ส่วนลด / 100)
ยอดจ่าย = ยอดรวม - ส่วนลด   ← ลูกค้าจ่ายเท่านี้

VAT ที่แสดง = ยอดจ่าย × (0.07 / 1.07)   ← VAT ที่รวมอยู่ใน ยอดจ่าย แล้ว
```

ตัวอย่าง: สินค้าราคา 107 บาท → VAT = 107 × (0.07/1.07) ≈ 7 บาท
แปลว่าราคา 107 บาทนั้น มี VAT อยู่ 7 บาทแล้ว ไม่ต้องบวกเพิ่ม

---

## ตารางใน Database

```
shops         — ข้อมูลร้านค้า (ชื่อ, PromptPay ID, tax rate)
profiles      — ข้อมูลพนักงาน (ชื่อ, role: owner/cashier, shop_id)
categories    — หมวดหมู่สินค้า
products      — สินค้า (ชื่อ, ราคา, สต๊อก, รูป, shop_id)
orders        — ออเดอร์ (สถานะ, shop_id, ยอดรวม)
order_items   — รายการสินค้าในแต่ละออเดอร์
payments      — การชำระเงิน (สถานะ, วิธีจ่าย, QR string)
ingredients   — วัตถุดิบ
stock_movements — ประวัติการเคลื่อนไหวสต๊อก
recipes       — สูตร: สินค้า 1 ชิ้น ตัดวัตถุดิบอะไรบ้าง
```

**Roles:**
- `owner` — เข้าถึงทุกอย่าง รวม dashboard และจัดการสินค้า
- `cashier` — ขายของได้ ดูออเดอร์ได้ แต่แก้ไขสินค้าไม่ได้

---

## เพิ่ม Feature ใหม่ — ทำตาม Checklist นี้ทุกครั้ง

### ตัวอย่าง: เพิ่ม "หมายเหตุออเดอร์" ให้แคชเชียร์กรอกได้

**ขั้นที่ 1 — แก้ Database**
```sql
-- สร้างไฟล์ใหม่: supabase/migrations/20260305000000_add_order_note.sql
ALTER TABLE orders ADD COLUMN note TEXT;
```
```bash
supabase db push   # push ขึ้น Supabase
```

**ขั้นที่ 2 — แก้ Type**
```typescript
// src/types/index.ts
interface Order {
  // ... field เดิม
  note?: string   // เพิ่มตรงนี้
}
```

**ขั้นที่ 3 — แก้ Store**
```typescript
// src/store/orderStore.ts
createOrder: async (shopId, cashierId, items, method, discount, taxRate, note?) => {
  const { data } = await supabase.from('orders').insert({
    shop_id: shopId,
    note: note ?? null,   // เพิ่มตรงนี้
    // ... field อื่น
  })
}
```

**ขั้นที่ 4 — แก้ UI**
```typescript
// app/(pos)/cart.tsx
const [note, setNote] = useState('')

<TextInput
  placeholder="หมายเหตุ (ถ้ามี)"
  value={note}
  onChangeText={setNote}
/>
// แล้วส่ง note ไปใน createOrder(...)
```

**ขั้นที่ 5 — เขียน Test**
```typescript
// __tests__/order.test.ts
it('should include note in order', async () => {
  await createOrder(shopId, userId, items, 'cash', 0, 0.07, 'ไม่ใส่ผัก')
  expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ note: 'ไม่ใส่ผัก' }))
})
```

**ขั้นที่ 6 — รัน Test**
```bash
npx jest   # ต้องผ่านทุก test ก่อน commit
```

---

## การเพิ่มสินค้าพร้อมรูปภาพ — รู้ไว้ก่อน

รูปสินค้าถูก upload ไปที่ **Supabase Storage** ใน bucket ชื่อ `product-images`

Flow:
```
แคชเชียร์กดเลือกรูป → expo-image-picker เปิด photo library
→ fetch(uri).arrayBuffer() → upload ไป Supabase Storage
→ ได้ URL กลับมา → บันทึกใน products.image_url
```

> ทำไมใช้ `arrayBuffer` ไม่ใช้ `blob`?
> เพราะ React Native ยังไม่ support `FormData` + `blob` upload ได้ดีในทุก platform
> `arrayBuffer` ทำงานได้ stable กว่าทั้ง iOS และ Android

---

## การรัน Tests

```bash
npx jest                          # รันครั้งเดียว
npx jest --watchAll               # watch mode (ระหว่าง develop)
npx jest --coverage               # ดู coverage report
npx jest __tests__/cart.test.ts   # รัน 1 ไฟล์
```

**Target coverage:** 70% branches / 80% functions+lines

**Test files ที่มี:**

| ไฟล์ | ทดสอบอะไร |
|------|----------|
| `cart.test.ts` | ตะกร้า, คำนวณราคา, VAT, ส่วนลด |
| `qr.test.ts` | สร้าง PromptPay QR string, CRC16 |
| `order.test.ts` | สร้างออเดอร์, complete, subscribe |
| `products.test.ts` | filter สินค้า, search |
| `auth.test.ts` | login, logout, initialize |
| `ingredient.test.ts` | ตัดสต๊อกวัตถุดิบ |
| `e2e_payment_flow.test.ts` | flow ทั้งหมด ตะกร้า → ออเดอร์ → จ่าย → confirm |

**วิธี mock Supabase ใน test:**
```typescript
jest.mock('../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 'mock-id' }, error: null }),
      eq: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
    })),
  },
}))
```
> ทำไม mock? เพราะ test ไม่ควรต่อ network จริง — ช้า, ต้องมี internet, ผลลัพธ์ไม่ stable

---

## คำสั่ง Supabase ที่ใช้บ่อย

```bash
supabase db push                          # push migration ขึ้น production
supabase migration list                   # ดูว่า migration ไหน applied แล้ว
supabase functions deploy notify-payment  # deploy Edge Function
supabase functions logs notify-payment    # ดู log ของ Edge Function
supabase secrets list                     # ดู environment variables ของ Edge Function
supabase secrets set KEY=value            # ตั้ง environment variable
```

---

## UX Requirements — ห้ามละเมิดเด็ดขาด

| # | กฎ | ตัวอย่างที่ผิด |
|---|----|--------------|
| R-UX-01 | ข้อความทุกจุดต้องเป็นภาษาไทย | "No products found" |
| R-UX-02 | วันที่ต้องใช้ `calendar: 'gregory'` | วันที่แสดงเป็น "69" (พ.ศ. 2 หลัก) |
| R-UX-03 | ปุ่มที่กดได้ต้องมี border หรือ background | ข้อความลอยๆ ที่ไม่รู้ว่ากดได้ |
| R-UX-04 | Error ทุกอย่างต้องแจ้ง user | หน้าแสดงเลข 0 โดยไม่บอกว่า network error |

**วิธีแสดงวันที่ที่ถูกต้อง:**
```typescript
const formatDate = (dateStr: string) => {
  const d = new Date(dateStr)
  const date = d.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    calendar: 'gregory'   // ← สำคัญมาก ถ้าไม่ใส่จะแสดงปี พ.ศ. 2 หลัก เช่น "69"
  })
  const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  return `${date}  ${time}`
}
```

---

## Security — สิ่งที่ต้องรู้

### ห้ามทำสิ่งเหล่านี้
- ❌ ใส่ service role key ใน client code (ใช้ใน Edge Function เท่านั้น)
- ❌ Commit ไฟล์ `.env` ขึ้น Git
- ❌ ทำ RLS policy แบบ UPDATE โดยไม่มี `WITH CHECK`

### WITH CHECK คืออะไร ทำไมสำคัญ?
```sql
-- ❌ แบบไม่ดี — ป้องกันแค่ "ดึงข้อมูลข้ามร้าน"
-- แต่ยัง "แก้ไขให้ข้อมูลไปอยู่ร้านอื่น" ได้อยู่
CREATE POLICY "update products"
  ON products FOR UPDATE
  USING (shop_id = get_my_shop_id());

-- ✅ แบบถูก — ทั้งดึงและแก้ไขต้องอยู่ในร้านเดิม
CREATE POLICY "update products"
  ON products FOR UPDATE
  USING  (shop_id = get_my_shop_id())
  WITH CHECK (shop_id = get_my_shop_id());
```

---

## Agents — ทีม AI ที่ช่วยพัฒนา

โปรเจคนี้ใช้ Claude Code Agents ช่วยพัฒนา กำหนดไว้ใน `.claude/agents/`

| Agent | หน้าที่ |
|-------|--------|
| **cto** | วางแผนงาน, assign task ให้ทีม, สรุปผล |
| **dev** | implement feature, แก้ bug |
| **qa** | ตรวจ logic, รัน test, หา edge case |
| **security** | audit RLS, ตรวจ secret exposure |
| **customer** | ทดสอบ UX บน simulator จาก screenshot จริง |
| **uxui** | ออกแบบ UI, ตรวจ spacing, สี |

**Pipeline ปกติ:**
```
cto สั่งงาน → dev แก้ → qa ตรวจ → security ตรวจ → customer ดูบน simulator → cto รายงาน
```

---

## ปัญหาที่พบบ่อย + วิธีแก้

**Metro bundler ค้าง / รัน Expo ไม่ขึ้น**
```bash
npx expo start --clear   # ล้าง cache แล้วรันใหม่
```

**TypeScript error: Cannot find module**
```bash
npm install   # reinstall dependencies
```

**Supabase migration fail: column already exists**
```bash
# migration นั้น apply ไปแล้ว ใช้คำสั่งนี้เพื่อ mark ว่า applied
supabase migration repair --status applied <timestamp>
```

**รูปสินค้าไม่ขึ้นหลัง upload**
1. ตรวจว่า bucket `product-images` มีอยู่ใน Supabase Storage
2. ตรวจว่า bucket เป็น Public
3. ตรวจว่า `saveProduct()` ส่ง `image_url` ไป insert/update ด้วย

**ตะกร้าไม่หายหลังจ่ายเงิน QR**
- ตรวจว่า `handleConfirmed` และ `handleManualConfirm` ใน `qr-payment.tsx` เรียก `clearCart()` ก่อน navigate

---

## Deployment — ส่ง app ให้คนอื่นใช้

### ทดสอบกับเพื่อน (ง่ายสุด)
```bash
npx expo start --tunnel
# ส่ง QR code ให้เพื่อน เปิดด้วย Expo Go app
```

### Build จริง (ต้องมีบัญชี Expo)
```bash
npm install -g eas-cli
eas login
eas build --platform ios --profile preview      # TestFlight
eas build --platform android --profile preview  # APK ส่งได้เลย
```

### Environment Variables บน EAS
```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://xxxx.supabase.co"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "eyJ..."
```
