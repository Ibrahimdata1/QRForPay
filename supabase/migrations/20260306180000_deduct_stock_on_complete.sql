-- Trigger: deduct products.stock when order status changes to 'completed'
-- Only deducts active items (not cancelled items)
-- Uses GREATEST(0, ...) to prevent negative stock

CREATE OR REPLACE FUNCTION deduct_product_stock_on_complete()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when status changes TO 'completed' from something else
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    UPDATE products p
    SET stock = GREATEST(0, p.stock - oi.quantity)
    FROM order_items oi
    WHERE oi.order_id = NEW.id
      AND oi.product_id = p.id
      AND (oi.item_status IS NULL OR oi.item_status = 'active');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_deduct_stock_on_complete ON orders;

CREATE TRIGGER trg_deduct_stock_on_complete
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION deduct_product_stock_on_complete();
