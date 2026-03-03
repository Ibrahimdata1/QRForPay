-- EasyShop POS - Database Schema
-- PostgreSQL / Supabase
--
-- ERD (crow's foot notation: ──< = one-to-many)
--
--   shops ──< profiles          (profiles.shop_id → shops.id)
--   shops ──o profiles          (shops.owner_id → profiles.id, one-to-one)
--   shops ──< categories ──< products   (FK: shop_id, category_id)
--   shops ──< orders ──< order_items >── products
--                  └──1 payments        (payments.order_id UNIQUE = one-to-one)

-- ============================================================
-- 1. Helper: updated_at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 2. Tables
-- ============================================================

-- Shops
CREATE TABLE shops (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  owner_id      UUID,  -- filled after profiles exist
  logo_url      TEXT,
  promptpay_id  TEXT NOT NULL DEFAULT '',
  tax_rate      NUMERIC(5,2) NOT NULL DEFAULT 7.00,
  created_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;

-- Profiles (mirrors auth.users)
CREATE TABLE profiles (
  id         UUID PRIMARY KEY,  -- same as auth.users.id
  shop_id    UUID REFERENCES shops(id) ON DELETE SET NULL,
  role       TEXT NOT NULL CHECK (role IN ('owner', 'cashier')),
  full_name  TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Now add FK from shops.owner_id -> profiles
ALTER TABLE shops
  ADD CONSTRAINT fk_shops_owner FOREIGN KEY (owner_id) REFERENCES profiles(id);

-- Categories
CREATE TABLE categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id    UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT,
  sort_order INT DEFAULT 0
);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Products
CREATE TABLE products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  price       DECIMAL(10,2) NOT NULL,
  image_url   TEXT,
  stock       INT DEFAULT 0,
  barcode     TEXT,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Orders
CREATE SEQUENCE orders_order_number_seq;

CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  order_number    INT NOT NULL DEFAULT nextval('orders_order_number_seq'),
  cashier_id      UUID REFERENCES profiles(id),
  status          TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  total_amount    DECIMAL(10,2),
  subtotal        DECIMAL(10,2),
  tax_amount      DECIMAL(10,2),
  discount_amount DECIMAL(10,2) DEFAULT 0,
  payment_method  TEXT CHECK (payment_method IN ('cash', 'qr', 'card')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  completed_at    TIMESTAMPTZ
);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Order Items
CREATE TABLE order_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity   INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  subtotal   DECIMAL(10,2) NOT NULL
);
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Payments
CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  method          TEXT NOT NULL CHECK (method IN ('cash', 'qr', 'card')),
  amount          DECIMAL(10,2) NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'expired')),
  qr_payload      TEXT,
  transaction_ref TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 3. Indexes
-- ============================================================

-- FK indexes
CREATE INDEX idx_profiles_shop_id    ON profiles(shop_id);
CREATE INDEX idx_categories_shop_id  ON categories(shop_id);
CREATE INDEX idx_products_shop_id    ON products(shop_id);
CREATE INDEX idx_products_category   ON products(category_id);
CREATE INDEX idx_orders_shop_id      ON orders(shop_id);
CREATE INDEX idx_orders_cashier_id   ON orders(cashier_id);
CREATE INDEX idx_order_items_order   ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- Business indexes
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_status       ON orders(status);
CREATE INDEX idx_products_barcode    ON products(barcode);
