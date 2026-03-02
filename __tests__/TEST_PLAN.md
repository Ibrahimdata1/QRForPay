# EasyShop POS - Test Plan

## 1. End-to-End Test Scenarios

### Scenario 1: Complete Cash Sale
**Steps:** Login -> Browse products -> Add 3 items -> Apply 10% discount -> Cash payment -> Print receipt
**Expected:** Order created, stock deducted for all 3 items, receipt shows correct subtotal, discount, tax (7%), grand total, and change amount.

### Scenario 2: QR Payment Happy Path
**Steps:** Login -> Add items -> Select QR payment -> QR displayed -> Simulate payment webhook -> Order completed
**Expected:** QR code displays within 2 seconds, contains valid PromptPay payload with correct amount, payment confirmed within 5 seconds of webhook, order status transitions to "completed".

### Scenario 3: QR Payment Timeout
**Steps:** Login -> Add items -> Select QR payment -> QR displayed -> Wait 5 minutes without payment
**Expected:** QR code expires after 300 seconds (Config.qr.timeout), order status set to "cancelled", stock is NOT deducted (rollback if pre-deducted), user sees expiry message in Thai.

### Scenario 4: Product Out of Stock
**Steps:** Add last item (stock=1) -> Complete purchase -> Try to add same item again
**Expected:** Error message displayed in Thai "สินค้าหมด", add button is disabled or shows out-of-stock state, cart rejects the addition.

### Scenario 5: Multi-Item Discount Order
**Steps:** Add 5+ different items -> Apply 15% store discount -> Review totals -> Confirm payment
**Expected:** Discount is calculated on subtotal BEFORE tax. Tax (7%) is applied on the discounted amount. Grand total = (subtotal - discount) * 1.07.

### Scenario 6: Cart Persistence
**Steps:** Add items to cart -> Close app -> Reopen app
**Expected:** Cart state persists via AsyncStorage, items and quantities restored on app launch.

### Scenario 7: Multi-Shop Isolation
**Steps:** Login as Shop A -> Add items -> Logout -> Login as Shop B
**Expected:** Shop B sees only its own products and orders. Cart is cleared on shop switch. Supabase RLS enforces data isolation.

---

## 2. Unit Test Coverage

### Cart Store (`cart.test.ts`)
- Add/remove/update items
- Quantity clamping to stock limits
- Discount calculation (percentage-based)
- Grand total computation (subtotal - discount + 7% tax)
- Out-of-stock rejection
- Cart clearing

### QR/PromptPay (`qr.test.ts`)
- EMV QR code payload generation
- CRC16 CCITT checksum validation
- Phone number formatting (Thai 0066 prefix)
- Tax ID vs phone number differentiation
- Amount encoding and currency code (764/THB)
- Unique reference generation
- Input validation (zero, negative, excessive amounts)

### Order Store (`order.test.ts`)
- Order creation with correct data structure
- Status transitions (pending -> confirmed -> completed)
- Payment completion marking
- Fetch with sorting (created_at descending)
- Total computation verification

### Receipt Utilities (`order.test.ts`)
- Thai Baht currency formatting
- Change calculation
- Edge cases (zero change, insufficient payment)

### Product Store (`products.test.ts`)
- Product fetching and population
- Category filtering
- Thai text search (case insensitive)
- Combined filter (category + search)
- Stock deduction with floor at 0
- Active/inactive product filtering

---

## 3. Performance Targets

| Operation | Target | Measurement Method |
|-----------|--------|--------------------|
| Product list load (1000 items) | < 2 seconds | Supabase query + render time |
| QR code generation | < 100ms | generatePromptPayPayload execution |
| Cart operations (add/remove/update) | < 16ms | Single frame budget (60fps) |
| Supabase query timeout | 10 seconds | AbortController / timeout config |
| App cold start | < 3 seconds | Expo splash screen to interactive |
| QR polling interval | 3 seconds | Config.qr.pollInterval |

---

## 4. Device Matrix

| Device | OS | Form Factor | Role |
|--------|----|-------------|------|
| iPhone 15 | iOS 17 | Phone | Customer-facing QR display |
| Samsung Galaxy S23 | Android 13 | Phone | Mobile cashier |
| iPad 10th gen | iPadOS 17 | Tablet | Primary POS station |
| Android tablet 10" | Android 13 | Tablet | Cashier station |
| Chrome (desktop) | Web | Desktop | Back-office / testing |

---

## 5. Network Scenarios

| Condition | Expected Behavior |
|-----------|-------------------|
| **WiFi (stable)** | Full functionality, real-time QR polling |
| **4G LTE** | QR polling with acceptable latency (< 1s), product images lazy-loaded |
| **Slow 3G** | Skeleton loading states, reduced image quality, extended timeouts |
| **Offline** | Cart operations work locally, payment disabled with clear message, orders queued for sync |
| **Intermittent** | Retry logic with exponential backoff, no duplicate order creation |

---

## 6. Security Test Cases

### 6.1 Input Validation
- **SQL injection in product search**: Enter `'; DROP TABLE products; --` in search field. Expected: Query parameterized, no SQL execution.
- **XSS in product names**: Product with name `<script>alert(1)</script>`. Expected: Rendered as text, not executed.
- **Numeric overflow**: Amount field with `99999999999`. Expected: Validation rejects, max 999999.

### 6.2 Authorization
- **Unauthorized shop data access (RLS)**: Attempt to query products with shop_id different from authenticated user's shop. Expected: Empty result set, RLS policy enforces isolation.
- **JWT token expiry handling**: Let token expire during session. Expected: Automatic refresh or redirect to login, no silent data exposure.
- **API key exposure**: Verify Supabase anon key is not logged or exposed in error messages.

### 6.3 Payment Security
- **Invalid QR payload rejection**: Tampered QR payload sent to verification endpoint. Expected: Rejected with error.
- **Replay attack**: Same payment reference used twice. Expected: Second attempt rejected as duplicate.
- **Amount tampering**: QR generated for 100 THB, webhook reports 50 THB. Expected: Payment flagged as mismatch.

---

## 7. Accessibility

- All interactive elements have accessible labels (Thai + English)
- Minimum touch target size: 44x44 points
- Color contrast ratio >= 4.5:1 for text
- Screen reader support for order totals and QR status

---

## 8. Localization

- All user-facing strings in Thai
- Currency formatted as Thai Baht (฿)
- Date/time in Thai timezone (Asia/Bangkok, UTC+7)
- Thai numeric formatting for large amounts
