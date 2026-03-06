# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

EasyShop POS — a Thai retail Point of Sale app with PromptPay QR payment. Built with Expo (React Native) + Supabase backend. All user-facing strings are in Thai.

## Build & Run Commands

```bash
# Install dependencies
npm install

# Start dev server (web + LAN for mobile)
bash start.sh              # sets EXPO_PUBLIC_APP_BASE_URL to LAN IP, starts web+lan

# Start normally
npx expo start             # dev server (scan QR with Expo Go)
npx expo start --web       # web only

# Run all tests (single run)
npx jest

# Run tests in watch mode
npm test

# Run a single test file
npx jest __tests__/qr.test.ts

# Run tests with coverage
npx jest --coverage

# Build & deploy web to Vercel
bash deploy-web.sh

# TypeScript check
npx tsc --noEmit
```

## Architecture

### Routing (Expo Router, file-based)

- `app/_layout.tsx` — Root layout with auth guard. Redirects to `/(auth)/login` or `/(pos)` based on session. Public routes (e.g. `/customer`) bypass auth.
- `app/(auth)/login.tsx` — Email/password login via Supabase Auth.
- `app/(pos)/_layout.tsx` — Tab navigator for POS staff: dashboard, live orders, order history, products, inventory, settings, tables. Cart tab is hidden (`href: null`).
- `app/(customer)/` — Customer self-ordering flow, accessed via table QR code. No auth required.
- `app/qr-payment.tsx` — Fullscreen modal for QR PromptPay payment display.

### State Management (Zustand + Immer)

All stores use `zustand/middleware/immer` for immutable updates:

- `src/store/authStore.ts` — Session, profile, shop. Clears cart on shop switch. Handles push token registration.
- `src/store/cartStore.ts` — Cart items, discount, tax. **Persisted to AsyncStorage** via `zustand/middleware/persist`. Exported selectors: `selectSubtotal`, `selectDiscountAmount`, `selectTaxAmount`, `selectGrandTotal`.
- `src/store/productStore.ts` — Products and categories fetched from Supabase. `selectFilteredProducts` selector combines category + search filters.
- `src/store/orderStore.ts` — Order CRUD, payment completion, Supabase Realtime subscription for payment status updates.

### Backend (Supabase)

- **7 tables**: `shops`, `profiles`, `categories`, `products`, `orders`, `order_items`, `payments`. All PKs are UUID.
- **RLS enabled on all tables** — data isolated by `shop_id`. Helper functions: `get_my_shop_id()`, `get_my_role()`.
- **Roles**: `owner` (full CRUD) and `cashier` (read products + create/update orders & payments).
- SQL files in `supabase/` must be run in order: `schema.sql` → `rls_policies.sql` → `seed.sql`.
- Supabase Realtime used for payment status polling (`postgres_changes` on `payments` table).

### Key Libraries

- `src/lib/qr.ts` — PromptPay EMV QR payload generation with CRC16-CCITT checksum. Phone numbers converted from `08x` → `0066x`.
- `src/lib/supabase.ts` — Supabase client configured with AsyncStorage for session persistence.
- `src/lib/receipt.ts` — Thai Baht formatting (`฿`) and plain-text receipt generation.

### Env & Config

- `.env` file with `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_PROMPTPAY_ID`.
- `constants/config.ts` — Centralizes supabase URL/key, tax rate (7% inclusive), QR timeout (300s). Note: PromptPay ID is now fetched from `shops` table at runtime, not from env vars.
- `constants/colors.ts` — App color tokens (primary teal `#0F766E`).

### Styling

- NativeWind (Tailwind for React Native) via `nativewind/preset` in `tailwind.config.js`.
- Custom colors defined in both `tailwind.config.js` (for className usage) and `constants/colors.ts` (for style props).
- `global.css` is the Tailwind entry point, processed through `withNativeWind` in `metro.config.js`.

## Important Conventions

- **Tax is VAT 7% inclusive** — prices already include VAT. Extract tax via `amount * (0.07 / 1.07)`. Discount is applied before tax extraction.
- **Path alias**: `@/*` maps to project root (configured in `tsconfig.json` and `jest.config.js`).
- **Metro config**: `unstable_conditionNames` is set to `['require', 'default', 'react-native', 'browser']` to avoid ESM `import.meta` issues with Zustand/Immer in Metro's CommonJS bundling.
- **Babel**: `babel-plugin-transform-import-meta` is required. `react-native-reanimated/plugin` must always be the **last** plugin.
- **TypeScript strict mode** is enabled.
- All business types are in `src/types/index.ts`.

## Testing

- Framework: Jest via `jest-expo` preset.
- Tests live in `__tests__/*.test.ts`. Test plan in `__tests__/TEST_PLAN.md`.
- `jest.setup.js` mocks AsyncStorage.
- Coverage targets: 70% branches, 80% functions/lines/statements. Coverage collected from `src/**/*.{ts,tsx}`.
- Supabase calls are mocked in tests — the test suite does not require a running Supabase instance.

## Web Deployment (Vercel)

- `deploy-web.sh` handles: Expo web export → copy icon fonts out of `node_modules` path (Vercel excludes these) → inject `@font-face` CSS → deploy with `vercel --prod`.
- `vercel.json` configures SPA routing.
