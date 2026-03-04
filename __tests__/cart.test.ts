import { useCartStore, selectSubtotal, selectGrandTotal } from '../src/store/cartStore';
import { Product } from '../src/types';

// Mock product factory
const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 'prod-1',
  shop_id: 'shop-1',
  name: 'Test Product',
  price: 100,
  stock: 10,
  is_active: true,
  category_id: 'cat-1',
  created_at: new Date().toISOString(),
  ...overrides,
});

describe('CartStore', () => {
  beforeEach(() => {
    // Reset store between tests
    const store = useCartStore.getState();
    store.clearCart();
  });

  test('addItem to empty cart creates new entry with quantity 1', () => {
    const product = makeProduct();
    const { addItem, items } = useCartStore.getState();

    addItem(product);

    const state = useCartStore.getState();
    expect(state.items).toHaveLength(1);
    expect(state.items[0].product.id).toBe('prod-1');
    expect(state.items[0].quantity).toBe(1);
  });

  test('addItem same product increments quantity', () => {
    const product = makeProduct();
    const store = useCartStore.getState();

    store.addItem(product);
    store.addItem(product);

    const state = useCartStore.getState();
    expect(state.items).toHaveLength(1);
    expect(state.items[0].quantity).toBe(2);
  });

  test('addItem updates subtotal correctly', () => {
    const product = makeProduct({ price: 250 });
    const store = useCartStore.getState();

    store.addItem(product);
    store.addItem(product);

    const state = useCartStore.getState();
    expect(selectSubtotal(state)).toBe(500);
  });

  test('removeItem removes product from cart', () => {
    const product = makeProduct();
    const store = useCartStore.getState();

    store.addItem(product);
    expect(useCartStore.getState().items).toHaveLength(1);

    store.removeItem('prod-1');
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  test('updateQuantity removes item when qty <= 0', () => {
    const product = makeProduct({ stock: 5 });
    const store = useCartStore.getState();

    store.addItem(product);

    // Setting quantity to 0 removes the item (per store implementation)
    store.updateQuantity('prod-1', 0);
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  // BOUNDARY: qty=1 is the last unit — decrement to 0 should auto-remove
  // UI layer (cart.tsx) MUST show a confirmation Alert before calling updateQuantity(id, 0)
  test('updateQuantity(id, 1) keeps item in cart at qty 1', () => {
    const product = makeProduct({ stock: 5 });
    const store = useCartStore.getState();

    store.addItem(product);
    store.addItem(product); // qty = 2
    store.updateQuantity('prod-1', 1); // decrement to 1

    const state = useCartStore.getState();
    expect(state.items).toHaveLength(1);
    expect(state.items[0].quantity).toBe(1);
  });

  test('updateQuantity(id, -1) also removes item (negative qty)', () => {
    const product = makeProduct({ stock: 5 });
    const store = useCartStore.getState();

    store.addItem(product);
    store.updateQuantity('prod-1', -1);

    expect(useCartStore.getState().items).toHaveLength(0);
  });

  test('applyDiscount sets discount percentage', () => {
    const product = makeProduct({ price: 200 });
    const store = useCartStore.getState();

    store.addItem(product);
    store.applyDiscount(10); // 10%

    const state = useCartStore.getState();
    expect(state.discount).toBe(10); // discount is stored as percentage
    expect(selectSubtotal(state)).toBe(200);
  });

  test('grandTotal = subtotal - discount (tax inclusive)', () => {
    const product = makeProduct({ price: 200 });
    const store = useCartStore.getState();

    store.addItem(product);
    store.applyDiscount(10); // 10% discount

    const state = useCartStore.getState();
    // Tax inclusive: grandTotal = subtotal - discountAmount = 200 - 20 = 180
    expect(selectGrandTotal(state)).toBeCloseTo(180, 2);
  });

  test('clearCart empties all items', () => {
    const store = useCartStore.getState();

    store.addItem(makeProduct({ id: 'p1' }));
    store.addItem(makeProduct({ id: 'p2' }));
    expect(useCartStore.getState().items.length).toBeGreaterThan(0);

    store.clearCart();
    const state = useCartStore.getState();
    expect(state.items).toHaveLength(0);
    expect(selectSubtotal(state)).toBe(0);
    expect(state.discount).toBe(0);
  });

  test('cannot add out-of-stock product (stock=0)', () => {
    const product = makeProduct({ stock: 0 });
    const store = useCartStore.getState();

    expect(() => store.addItem(product)).toThrow();
    // Or if it silently rejects:
    const state = useCartStore.getState();
    expect(state.items).toHaveLength(0);
  });

  test('add multiple different products', () => {
    const store = useCartStore.getState();

    store.addItem(makeProduct({ id: 'p1', name: 'Product A', price: 100 }));
    store.addItem(makeProduct({ id: 'p2', name: 'Product B', price: 200 }));
    store.addItem(makeProduct({ id: 'p3', name: 'Product C', price: 50 }));

    const state = useCartStore.getState();
    expect(state.items).toHaveLength(3);
    expect(selectSubtotal(state)).toBe(350);
  });

  test('setResumeOrder sets resumeOrderId and loads items into cart', () => {
    const store = useCartStore.getState();
    const product = makeProduct({ id: 'resume-p1', price: 150 });
    const cartItems = [{ product, quantity: 2, subtotal: 300 }];

    store.setResumeOrder('order-abc', cartItems);

    const state = useCartStore.getState();
    expect(state.resumeOrderId).toBe('order-abc');
    expect(state.items).toHaveLength(1);
    expect(state.items[0].product.id).toBe('resume-p1');
    expect(state.items[0].quantity).toBe(2);
  });

  test('setResumeOrder resets discount to 0', () => {
    const store = useCartStore.getState();

    store.applyDiscount(20);
    store.setResumeOrder('order-xyz', []);

    const state = useCartStore.getState();
    expect(state.discount).toBe(0);
  });

  test('clearResumeOrder resets resumeOrderId and empties cart', () => {
    const store = useCartStore.getState();
    const product = makeProduct({ id: 'p-clear', price: 100 });
    store.setResumeOrder('order-123', [{ product, quantity: 1, subtotal: 100 }]);

    store.clearResumeOrder();

    const state = useCartStore.getState();
    expect(state.resumeOrderId).toBeNull();
    expect(state.items).toHaveLength(0);
    expect(state.discount).toBe(0);
  });

  test('clearCart also clears resumeOrderId', () => {
    const store = useCartStore.getState();
    const product = makeProduct();

    store.setResumeOrder('order-456', [{ product, quantity: 1, subtotal: 100 }]);
    expect(useCartStore.getState().resumeOrderId).toBe('order-456');

    store.clearCart();
    const state = useCartStore.getState();
    expect(state.resumeOrderId).toBeNull();
    expect(state.items).toHaveLength(0);
  });
});
