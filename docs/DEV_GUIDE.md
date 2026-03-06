# Dev Guide — QRForPay POS
> คู่มือสำหรับนักพัฒนา — เขียนให้มือใหม่ที่ย้ายสายอ่านแล้วเข้าใจได้เลย

---

## แอพนี้คืออะไร?

**QRForPay POS** คือแอพขายของหน้าร้านสำหรับร้านค้าไทย รองรับทั้ง iOS และ Android
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
│   ├── (pos)/                    ← ทุกหน้าหลังล็อกอิน (staff only)
│   │   ├── _layout.tsx           ← แถบ tab ด้านล่าง
│   │   ├── index.tsx             ← โต๊ะสด — จอมอนิเตอร์ออเดอร์ realtime
│   │   ├── orders.tsx            ← ประวัติออเดอร์ทั้งหมด
│   │   ├── tables.tsx            ← visual table grid สถานะสีตาม order + QR ต่อโต๊ะ
│   │   ├── products.tsx          ← จัดการสินค้า
│   │   ├── inventory.tsx         ← จัดการวัตถุดิบ/สต๊อก
│   │   ├── dashboard.tsx         ← สรุปยอดขาย
│   │   ├── settings.tsx          ← ตั้งค่าร้าน
│   │   └── cart.tsx              ← (hidden) ตะกร้า legacy
│   ├── (customer)/               ← หน้าลูกค้า — ไม่ต้อง login
│   │   ├── _layout.tsx           ← ErrorBoundary, no auth guard
│   │   └── customer.tsx          ← เมนู + สั่งอาหาร + ชำระเงิน QR  (URL: /customer)
│   └── qr-payment.tsx            ← Modal QR รอจ่าย (legacy staff flow)
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
│   ├── colors.ts                 ← Static light palette (ใช้โดย Colors export เดิม)
│   ├── ThemeContext.tsx          ← Light/Dark palettes + useTheme() hook + ThemeProvider
│   ├── theme.ts                  ← Design tokens: shadow, radius, space, typography
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
app/login.tsx                  →  /login
app/(pos)/dashboard.tsx        →  /dashboard  (tab: แดชบอร์ด)
app/(pos)/orders.tsx           →  /orders     (tab: ออเดอร์)
app/(pos)/products.tsx         →  /products   (tab: สินค้า)
app/(pos)/tables.tsx           →  /tables     (tab: โต๊ะ)
app/(pos)/settings.tsx         →  /settings   (tab: ตั้งค่า)
app/(pos)/index.tsx            →  /           (hidden — redirect ไป /dashboard)
app/(pos)/cart.tsx             →  /cart       (hidden — modal จาก POS)
app/(customer)/customer.tsx    →  /customer   (ลูกค้าสแกน QR เปิดที่นี่)
app/qr-payment.tsx             →  /qr-payment (fullScreenModal)
```

> ⚠️ **Route Group Rule**: วงเล็บ `(name)` คือ URL-transparent — `(customer)/customer.tsx` → URL `/customer`
> ถ้าใช้ `(customer)/index.tsx` จะได้ URL `/` แทน (ชน root!) — ต้องใช้ชื่อไฟล์ตรงกับ URL ที่ต้องการเสมอ

วงเล็บ `(pos)` หมายความว่า "group" — ชื่อ folder ไม่ปรากฏใน URL แต่แชร์ layout เดียวกัน (แถบ tab ด้านล่าง)

**การ navigate ระหว่างหน้า:**
```typescript
import { router } from 'expo-router'

router.push('/qr-payment')          // ไปหน้าใหม่ (กลับได้)
router.replace('/(pos)')            // ไปหน้าใหม่แล้วลบหน้าเก่าออก (กลับไม่ได้)
router.back()                       // กลับหน้าก่อนหน้า
```

---

## ระบบสั่งอาหารผ่าน QR โต๊ะ (Customer QR Ordering)

โมเดลหลักของแอพนี้คือ **ลูกค้าสั่งเองผ่านโทรศัพท์** — พนักงานไม่ต้องรับออเดอร์

### Flow ทั้งหมด

```
พนักงาน:
  1. เปิดแท็บ "โต๊ะ QR" → เลือกหมายเลขโต๊ะ → กด "สร้าง QR"
  2. พิมพ์ QR หรือตั้งจอบนโต๊ะ

ลูกค้า:
  3. สแกน QR ด้วยกล้องโทรศัพท์
  4. เบราเซอร์เปิด http://<IP>:8081/customer?shop=<shopId>&table=<num>
  5. เลือกเมนู → เพิ่มใส่ตะกร้า → กด "สั่งและชำระเงิน"
  6. สแกน PromptPay QR ด้วยแอปธนาคาร
  7. หน้าสถานะอัพเดตอัตโนมัติ (realtime)

พนักงาน (จอ "โต๊ะสด"):
  8. เห็นออเดอร์ใหม่ปรากฏทันที (realtime)
  9. กด "เริ่มทำอาหาร" → "พร้อมเสิร์ฟ" → "เสร็จสิ้น"
  10. ถ้าลูกค้าจ่ายเงินสด: กด "รับเงิน" (manual payment override)
```

### Customer UX Features (app/(customer)/customer.tsx)

| Feature | รายละเอียด |
|---------|-----------|
| **Screen state machine** | `loading → menu → cart → confirm → paying → success` |
| **QR countdown timer** | 5 นาที — แดงเมื่อเหลือ < 60 วินาที ปุ่ม regenerate ถ้าหมดเวลา |
| **Kitchen status banner** | แสดง "ครัวกำลังปรุง..." เมื่อ order status = preparing |
| **Success screen** | หน้าขอบคุณพร้อมเลข order (ไม่ใช้ alert) |
| **Per-item restore** | ระบบ restore รายการที่ยังไม่ถูกยกเลิกเมื่อลูกค้ากลับมาสั่งเพิ่ม |
| **Session privacy** | `customer_session_id` ป้องกัน restore ออเดอร์ของโต๊ะอื่น |
| **Realtime cancel** | ถ้าร้านยกเลิกรายการ → ยอดรวมบนหน้าลูกค้าอัพเดตทันที |
| **Multi-order per table** | สั่งเพิ่มทุกรอบสร้าง order ใหม่ ไม่ append เข้า order เดิม |
| **Combined table view** | ตะกร้าแสดงรายการจากทุก order ของโต๊ะ แยกสถานะ (เสิร์ฟแล้ว/กำลังเตรียม/รอ) |
| **Auto-reload polling** | Poll `get_table_combined_view` ทุก 10 วินาที + realtime subscription ทุก order ของโต๊ะ |
| **Payment button** | ปุ่ม "ชำระเงิน" แสดงยอดรวมทั้งโต๊ะ + ลิงก์ "สั่งเพิ่ม" เป็น secondary |

### กฎสำคัญ

| กฎ | รายละเอียด |
|----|-----------|
| **ลูกค้าสั่งเอง** | orders สร้างผ่าน anon Supabase client เท่านั้น |
| **table_number บังคับ** | customer orders ต้องมี table_number (CHECK constraint) |
| **ลูกค้ายกเลิกทั้งออเดอร์ได้** | กดยกเลิกก่อน confirm — ไม่ได้หลังยืนยันแล้ว |
| **พนักงานยกเลิกต่อรายการได้** | `order_items.item_status = 'cancelled'` ผ่านแท็บ "โต๊ะ" หรือ "บิลรวมโต๊ะ" |
| **พนักงานยกเลิกทั้งออเดอร์ได้** | กดถังขยะในบิลรวมโต๊ะ → ยกเลิกทั้ง order (มี warning ถ้าครัวทำแล้ว) |
| **Anti-table-switching** | sessionStorage ตรวจจับการเปลี่ยนโต๊ะในแท็บเดียวกัน |
| **Manual payment** | พนักงานกด "รับเงิน" → บันทึกใน payments (confirmation_type='manual') |

### URL ที่ใช้

```
Production (Vercel):
https://qrforpay.vercel.app/customer?shop=<shopId>&table=<tableNumber>

Local dev:
http://192.168.1.107:8081/customer?shop=<shopId>&table=<tableNumber>
```

### รันสำหรับทดสอบ QR

```bash
# วิธีที่ 1 — ใช้ start.sh (auto-detect IP)
bash start.sh

# วิธีที่ 2 — manual
npx expo start --web --host lan
# แล้วแก้ .env: EXPO_PUBLIC_APP_BASE_URL=http://<IP-ของเครื่อง>:8081
```

> **สำคัญ**: ต้องใช้ `--web` mode เท่านั้น เพราะลูกค้าเปิดผ่านเบราเซอร์

### DB Columns ที่เกี่ยวข้อง

```sql
orders.order_source        -- 'pos' หรือ 'customer'
orders.table_number        -- หมายเลขโต๊ะ (TEXT, required สำหรับ customer orders)
orders.customer_session_id -- session UUID สำหรับ track ออเดอร์
payments.confirmation_type -- 'manual' หรือ 'auto'
payments.confirmed_by      -- UUID ของพนักงานที่กด manual confirm
order_items.item_status    -- 'active' (default) หรือ 'cancelled' (per-item soft cancel)
order_items.item_cancelled_by   -- UUID ของพนักงานที่ยกเลิก
order_items.item_cancelled_at   -- timestamp ที่ยกเลิก
shops.table_count          -- จำนวนโต๊ะ (เจ้าของตั้งจาก settings) default 10
```

### Migrations ทั้งหมด (ตามลำดับ)

```bash
# 1. Base schema
psql $DB_URL -f supabase/schema.sql

# 2. Customer ordering support (anon RLS, order_source, etc.)
supabase/migrations/20260304120000_customer_ordering.sql

# 3. Table monitor setup (payment_overrides, constraints)
supabase/migrations/20260305000000_table_monitor_setup.sql

# 4. Anon cancel order permission
supabase/migrations/20260305120000_anon_cancel_order.sql

# 5. RPC: get_order_for_customer (SECURITY DEFINER)
supabase/migrations/20260306100000_customer_order_rpc.sql

# 6. RPC: get_order_items_for_customer (SECURITY DEFINER)
supabase/migrations/20260306110000_customer_order_items_rpc.sql

# 7. shops.table_count column
supabase/migrations/20260306200000_add_table_count.sql

# 8. Enable Supabase Realtime for orders + payments tables
supabase/migrations/20260306300000_enable_realtime.sql

# 9. RPC: get_table_combined_view (combined bill for customer web)
supabase/migrations/20260306190000_get_table_combined_view.sql
```

> **⚠️ สำคัญมาก**: Migration #8 (`enable_realtime`) ต้อง apply ก่อน Realtime จะทำงาน
> ถ้าข้าม migration นี้ การ subscribe จะไม่ได้รับ event เลย แม้โค้ดจะถูกต้อง

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
- **Realtime** — รับ event เมื่อข้อมูลใน DB เปลี่ยน (ใช้อัพเดตสถานะโต๊ะและตรวจจับการจ่ายเงิน)

### ⚠️ Supabase Realtime — ต้อง Enable ก่อนใช้งาน!

Realtime ใน Supabase **ไม่ได้เปิดอัตโนมัติ** สำหรับทุกตาราง ต้อง add ตารางเข้า publication ก่อน:

```sql
-- ต้อง apply migration นี้ก่อน realtime จะทำงาน
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE payments;
```

ถ้าไม่ได้ apply: โค้ด subscribe จะทำงานได้ปกติ ไม่มี error — **แต่ไม่ได้รับ event เลย**

ตรวจสอบว่า apply แล้วหรือยัง:
```bash
supabase migration list --linked  # ดู migration ที่ apply แล้ว
```

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

### Table Management (โต๊ะสำหรับร้านอาหาร)

ระบบรองรับ flow แบบ "บันทึกออเดอร์ก่อน จ่ายทีหลัง" สำหรับร้านอาหาร

**สถานะโต๊ะ (derive จาก active orders — ไม่มีตาราง tables แยก):**

```
🟢 ว่าง     = ไม่มี order pending/preparing/ready
🟠 รอทำ     = มี order status=pending (ลูกค้าสั่งแล้ว รอทำ)
🟣 กำลังทำ  = มี order status=preparing
🔵 พร้อมเสิร์ฟ = มี order status=ready

completed/cancelled → โต๊ะกลับเป็น 🟢 ว่างอัตโนมัติ
```

**shops.table_count** — จำนวนโต๊ะที่แสดงใน grid (เจ้าของตั้งใน settings)
โต๊ะที่ไม่ใช่ตัวเลข (A1, VIP) → แสดงในส่วน "โต๊ะอื่นๆ" ด้านล่าง grid

**สถานะออเดอร์:**

```
สถานะออเดอร์:
  pending   = โต๊ะเปิดอยู่ — ลูกค้ายังอยู่ ยังไม่จ่าย
  preparing = ครัวกำลังทำ
  ready     = พร้อมเสิร์ฟ
  completed = จ่ายเงินแล้ว — เสร็จสิ้น
  cancelled = ยกเลิกแล้ว
```

**Flow หลักสำหรับร้านอาหาร:**

```
1. แคชเชียร์เลือกสินค้าในหน้า POS → ไปหน้าตะกร้า
         ↓
2. (ไม่บังคับ) กรอกหมายเลขโต๊ะ เช่น "5", "A2"
         ↓
3. กดปุ่ม "บันทึกออเดอร์" (สีเขียว)
   → createOrder() สร้างออเดอร์ status=pending
   → clearCart() ล้างตะกร้า
   → navigate ไปหน้า orders
         ↓
4. หน้า orders แสดงส่วน "โต๊ะเปิดอยู่" ที่ด้านบน
   เห็นโต๊ะที่ยังรอชำระ — เรียงตามเวลาที่เปิด (เก่าสุดขึ้นก่อน)
         ↓
5. (ถ้าลูกค้าสั่งเพิ่ม) กดปุ่ม "+ เพิ่มสินค้า" บน pending card
   → navigate ไปหน้า POS พร้อม resumeOrderId
   → หน้า POS โหลด items เดิมเข้า cart โดยอัตโนมัติ
   → แคชเชียร์เลือกสินค้าเพิ่ม → กด "บันทึกเพิ่ม"
   → addItemsToOrder() เพิ่ม items และ update ยอดรวม
         ↓
6. เมื่อลูกค้าพร้อมจ่าย:
   → กดปุ่ม "ชำระเงิน" ในหน้า orders หรือ OrderDetailModal
   → ไปหน้า POS พร้อม resumeOrderId → ไปตะกร้า
   → กดปุ่ม "ชำระ ฿xxx" (สีน้ำเงิน) — flow ปกติ
```

### QR PromptPay

```
1. แคชเชียร์กด "ชำระ QR" ใน cart.tsx
         ↓
2a. ถ้าเป็น resumeOrderId (ชำระออเดอร์เดิม):
    addItemsToOrder() update ยอดรวม
2b. ถ้าเป็นออเดอร์ใหม่:
    createOrder() — INSERT ลง DB:
    - ตาราง orders     (สถานะ: pending, บันทึก table_number ถ้ามี)
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
2a. ถ้ามี resumeOrderId: addItemsToOrder() update ยอดก่อน
2b. ถ้าออเดอร์ใหม่: createOrder()
         ↓
3. completeOrder() ทันที (ไม่รอยืนยัน)
   บันทึก cash_received, cash_change, confirmed_by ลง payments
         ↓
4. clearCart() → navigate หน้าออเดอร์
```

### ยกเลิกออเดอร์ (ทั้งออเดอร์)

```
1. แคชเชียร์กดดูรายละเอียดออเดอร์ (pending เท่านั้น)
         ↓
2. กดปุ่ม "ยกเลิก" → Alert ยืนยัน
         ↓
3. cancelOrder() — UPDATE orders:
   status = 'cancelled', cancelled_at = now(), cancelled_by = profile.id
   UPDATE payments: status = 'failed' (ถ้ายังเป็น pending)
         ↓
4. ออเดอร์ยังอยู่ในระบบ — แสดงสถานะ "ยกเลิก" + ชื่อคนยกเลิก
```

### ยกเลิกต่อรายการ (Per-Item Cancel)

```
1. พนักงานเปิดโต๊ะ → กดปุ่ม X ข้างรายการ → ยืนยัน
         ↓
2. cancelOrderItem() — UPDATE order_items:
   item_status = 'cancelled', item_cancelled_by = profile.id, item_cancelled_at = now
         ↓
3. Re-fetch items → คำนวณ total ใหม่จาก active items เท่านั้น
   UPDATE orders: total_amount, subtotal, tax_amount
   UPDATE payments: amount (ถ้ายังเป็น pending)
         ↓
4. ถ้า active items = 0 → cancelOrder() อัตโนมัติ
         ↓
5. หน้าลูกค้า (Vercel) รับ Realtime event → ยอดรวมอัพเดตทันที
```

### ออเดอร์ — หน้าเดียว 2 sections (orders.tsx)

หน้าออเดอร์แสดง 2 sections ในหน้าเดียว (ไม่มี segment control):

**Section บน — ออเดอร์ที่ต้องจัดการ:**
- แสดงเฉพาะ pending + preparing เป็น cards แนวนอน (horizontal scroll)
- Sort: pending ก่อน preparing, เก่าสุดก่อน
- Card สี: pending = พื้นชมพู ขอบแดง, preparing = พื้นเหลือง ขอบส้ม
- แสดง "X นาทีที่แล้ว" บน card
- ปุ่ม 1 ปุ่มต่อ card: pending → "รับออเดอร์", preparing → "พร้อมเสิร์ฟ"
- ออเดอร์ใหม่มีป้าย "ใหม่!" สีแดง + สั่นเตือน (mobile)
- ถ้าไม่มีออเดอร์: แสดง "ไม่มีออเดอร์ใหม่" 1 บรรทัด
- icon แว่นขยายมุมขวาบน → expand search bar + filter pills

**Section ล่าง — บิลรวมโต๊ะ:**
- Group orders by `table_number` → แสดงเป็น bill card ต่อโต๊ะ
- **รายการเมนูรวม**: เมนูเดียวกันจากหลายออเดอร์รวมเป็นบรรทัดเดียว (merge by product_id, `sourceItems[]` tracking)
- **แต่ละออเดอร์แจกแจงรายละเอียด**: เลขออเดอร์ + status pill + รายการเมนู (merge ไม่ซ้ำ)
- ยกเลิกรายเมนู: ปุ่ม X ข้างแต่ละ item → `cancelOrderItem()` (รองรับ batch cancel ผ่าน `itemIds[]`)
- ยกเลิกทั้ง order: ปุ่มถังขยะข้างเลขออเดอร์ → `cancelOrder()`
- ยกเลิกทั้งโต๊ะ: ปุ่ม "ยกเลิกทั้งโต๊ะ" มุมขวาบนของ bill card → ยกเลิกทุกออเดอร์ (per-order try/catch + partial failure summary)
- รายการยกเลิกแสดงขีดฆ่า + สีจาง
- ปุ่มชำระ: "ยืนยันรับโอน" + "รับเงินสด" → loop `completeOrder()` ทุก order ของโต๊ะ
- cash_received/cash_change เซ็ตเฉพาะ order สุดท้าย (ป้องกัน duplication)

**New order alert (root _layout.tsx + pos _layout.tsx):**
- Realtime subscription + `initializedRef` pattern ตรวจจับ order ใหม่
- `Vibration.vibrate()` + แบนเนอร์สีแดง absolute top ทุกหน้า (zIndex 99999)
- `orderStore.alertInfo` + `newOrderIds` เก็บ state ข้ามหน้า

### Cart Isolation — สิ่งที่ต้องรู้

- `cartStore.resumeOrderId` เก็บ orderId ที่กำลัง resume อยู่
- `setResumeOrder(orderId, items)` — load items เดิมเข้า cart
- `clearResumeOrder()` — reset resumeOrderId + เคลียร์ cart
- `clearCart()` — รวม clearResumeOrder ด้วย (ป้องกัน state หลงเหลือ)
- `authStore.signOut()` — เรียก `clearResumeOrder()` ก่อน `clearCart()` เสมอ (ป้องกัน cart leak ข้าม session)

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
- `cashier` — ขายของได้ ดูออเดอร์ได้ ยกเลิกออเดอร์ได้ แต่แก้ไขสินค้าไม่ได้

**Columns เพิ่มเติม (migrations ล่าสุด):**

| ตาราง | Column ใหม่ | ความหมาย |
|-------|------------|----------|
| `orders` | `cancelled_at` | timestamp ที่ยกเลิก |
| `orders` | `cancelled_by` | UUID ของคนที่กดยกเลิก (FK → profiles) |
| `orders` | `cancel_reason` | เหตุผลการยกเลิก (optional) |
| `orders` | `table_number` | หมายเลขโต๊ะ (optional TEXT เช่น "5", "A2") |
| `orders` | `order_source` | 'pos' หรือ 'customer' |
| `orders` | `customer_session_id` | UUID session ลูกค้า (privacy isolation) |
| `order_items` | `item_status` | 'active' (default) หรือ 'cancelled' |
| `order_items` | `item_cancelled_by` | UUID ผู้ยกเลิกรายการ (FK → profiles) |
| `order_items` | `item_cancelled_at` | timestamp ที่ยกเลิกรายการ |
| `payments` | `cash_received` | เงินที่ลูกค้าให้มา |
| `payments` | `cash_change` | เงินทอน |
| `payments` | `confirmation_type` | 'manual' หรือ 'auto' |
| `payments` | `confirmed_by` | UUID ของคนที่กดยืนยัน |
| `profiles` | `push_token` | Expo push token สำหรับ push notification |
| `shops` | `table_count` | จำนวนโต๊ะ (INTEGER, default 10, ตั้งได้ใน settings) |

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

## Dark/Light Mode — ระบบธีม

แอพรองรับ Dark/Light mode ผ่าน `ThemeContext` — ทุกหน้าต้องใช้ pattern นี้เสมอ

### Pattern หลัก (บังคับทุก screen/component ใหม่)

```typescript
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useTheme, ThemeColors } from '../../constants/ThemeContext';

export default function MyScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // ...
}

// ✅ ถูก — อยู่นอก component
const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { backgroundColor: colors.background },
});

// ❌ ผิด — StyleSheet.create ที่ module level ใช้ colors ไม่ได้
const styles = StyleSheet.create({
  container: { backgroundColor: colors.background }, // ReferenceError!
});
```

### ThemeColors ที่ใช้บ่อย

| Token | Light | Dark | ใช้กับอะไร |
|-------|-------|------|-----------|
| `colors.background` | `#F8FAFC` | `#09090B` | พื้นหลังหน้าจอ |
| `colors.surface` | `#FFFFFF` | `#18181B` | Card, Modal, Bottom sheet |
| `colors.border` | `#E2E8F0` | `#3F3F46` | เส้นขอบ input, divider |
| `colors.borderLight` | `#F1F5F9` | `#27272A` | พื้นหลัง pill, subtle bg |
| `colors.text.primary` | `#0F172A` | `#FAFAFA` | ข้อความหลัก |
| `colors.text.secondary` | `#64748B` | `#A1A1AA` | ข้อความรอง |
| `colors.text.light` | `#94A3B8` | `#71717A` | placeholder, hint |
| `colors.primary` | `#0F766E` | `#14B8A6` | สี brand, ปุ่มหลัก |
| `colors.gradient.primary` | deep teal | deep teal dark | LinearGradient hero |

### ตั้งค่าธีม

ผู้ใช้เปลี่ยนได้ที่ **ตั้งค่า → ธีม** (สว่าง / มืด)
บันทึกลง AsyncStorage ด้วย key `@qrforpay:theme_override`

```typescript
const { colors, isDark, setOverride } = useTheme();
setOverride('dark');   // บังคับ dark
setOverride('light');  // บังคับ light
setOverride(null);     // ตามระบบ
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
| **pm** | แปล business request เป็น spec card |
| **dev** | implement feature, แก้ bug |
| **qa** | ตรวจ logic, รัน test, หา edge case |
| **security** | audit RLS, ตรวจ secret exposure |
| **customer** | ทดสอบ UX จากมุมลูกค้าจริง |
| **uxui** | ออกแบบ UI, ตรวจ spacing, สี, icon |
| **product-strategy** | วางกลยุทธ์ธุรกิจร้านอาหาร, food cost, POS flow |
| **devops** | deploy (Vercel, EAS, Supabase migration) |

**Pipeline ปกติ:**
```
cto สั่งงาน → dev แก้ → qa ตรวจ → security ตรวจ → customer ดูบน simulator → cto รายงาน
```

---

## Demo Accounts (Development)

**ร้าน 1 — QRForPay Demo** (`11111111-1111-1111-1111-111111111111`)
| Role | UUID |
|------|------|
| Owner | `82e5d187-a910-4669-852e-25a90b8c448e` |
| Cashier 1 | `8aaf7842-776d-4664-862e-b5d056a9c95d` |
| Cashier 2 | `0b322b97-4a46-4717-9b1b-aba79c745410` |

**ร้าน 2 — PowerTech เครื่องใช้ไฟฟ้า** (`22222222-2222-2222-2222-222222222222`)
| Role | UUID |
|------|------|
| Owner | `f74188ae-98b1-4340-ab9d-de7702e27088` |

> UUID เหล่านี้ต้องมีอยู่ใน `auth.users` ของ Supabase ก่อนจึงจะ login ได้

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

## Web Deploy (Customer QR Page บน Vercel)

หน้าลูกค้า (`/customer`) deploy บน Vercel แยกต่างหากจาก mobile app

```bash
# deploy ทุกครั้งด้วยคำสั่งนี้เดียว — ทำ export + fonts + vercel.json + deploy ให้หมด
bash deploy-web.sh
```

> ❌ **ห้ามรัน** `expo export` หรือ `vercel --prod` ตรงๆ — fonts จะพัง (Vercel ไม่รู้จัก node_modules paths)

**URL Production**: `https://qrforpay.vercel.app`

**`deploy-web.sh` ทำอะไร:**
1. `npx expo export --platform web` → สร้างโฟลเดอร์ `dist/`
2. Copy font files → `dist/_expo/static/fonts/`
3. Inject `@font-face` CSS ใน `dist/index.html` (แก้ปัญหา icon แสดงเป็น □)
4. Copy `vercel.json` → `dist/` (SPA routing)
5. `npx vercel --prod --yes` จาก `dist/`

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
