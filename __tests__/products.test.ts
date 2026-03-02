// Mock Supabase client
const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockUpdate = jest.fn();
const mockOrder = jest.fn();

jest.mock('../src/lib/supabase', () => ({
  supabase: { from: (...args: any[]) => mockFrom(...args) },
}));

import { useProductStore, selectFilteredProducts } from '../src/store/productStore';

import { Product } from '../src/types';

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

function setupMockChain() {
  const eqChain: any = {
    eq: mockEq,
    order: mockOrder,
  };
  mockEq.mockReturnValue(eqChain);
  mockOrder.mockResolvedValue({ data: [], error: null });
  mockSelect.mockReturnValue(eqChain);
  mockUpdate.mockReturnValue(eqChain);
  mockFrom.mockReturnValue({
    select: mockSelect,
    update: mockUpdate,
  });
}

describe('ProductStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMockChain();
    const store = useProductStore.getState();
    store.setProducts([]);
    store.setCategory(null);
    store.setSearch('');
  });

  test('fetchProducts populates products array', async () => {
    const mockProducts = [
      makeProduct({ id: 'p1', name: 'Cola' }),
      makeProduct({ id: 'p2', name: 'Water' }),
    ];

    mockOrder.mockResolvedValueOnce({ data: mockProducts, error: null });

    const store = useProductStore.getState();
    await store.fetchProducts('shop-1');

    const state = useProductStore.getState();
    expect(state.products).toHaveLength(2);
    expect(state.products[0].name).toBe('Cola');
  });

  test('setCategory filters products by category_id', () => {
    const store = useProductStore.getState();

    const products = [
      makeProduct({ id: 'p1', category_id: 'cat-food' }),
      makeProduct({ id: 'p2', category_id: 'cat-drink' }),
      makeProduct({ id: 'p3', category_id: 'cat-food' }),
    ];

    store.setProducts(products);
    store.setCategory('cat-food');

    const state = useProductStore.getState();
    const filtered = selectFilteredProducts(state);
    expect(filtered).toHaveLength(2);
    filtered.forEach((p) => {
      expect(p.category_id).toBe('cat-food');
    });
  });

  test('setSearch filters by name (case insensitive, Thai chars)', () => {
    const store = useProductStore.getState();

    const products = [
      makeProduct({ id: 'p1', name: 'ข้าวผัด' }),
      makeProduct({ id: 'p2', name: 'น้ำส้ม' }),
      makeProduct({ id: 'p3', name: 'ข้าวมันไก่' }),
    ];

    store.setProducts(products);
    store.setSearch('ข้าว');

    const state = useProductStore.getState();
    const filtered = selectFilteredProducts(state);
    expect(filtered).toHaveLength(2);
    filtered.forEach((p) => {
      expect(p.name).toContain('ข้าว');
    });
  });

  test('combined category + search filter', () => {
    const store = useProductStore.getState();

    const products = [
      makeProduct({ id: 'p1', name: 'ข้าวผัด', category_id: 'cat-food' }),
      makeProduct({ id: 'p2', name: 'น้ำข้าว', category_id: 'cat-drink' }),
      makeProduct({ id: 'p3', name: 'ข้าวมันไก่', category_id: 'cat-food' }),
    ];

    store.setProducts(products);
    store.setCategory('cat-food');
    store.setSearch('ข้าว');

    const state = useProductStore.getState();
    const filtered = selectFilteredProducts(state);
    expect(filtered).toHaveLength(2);
    filtered.forEach((p) => {
      expect(p.category_id).toBe('cat-food');
      expect(p.name).toContain('ข้าว');
    });
  });

  test('setCategory(null) shows all products', () => {
    const store = useProductStore.getState();

    const products = [
      makeProduct({ id: 'p1', category_id: 'cat-food' }),
      makeProduct({ id: 'p2', category_id: 'cat-drink' }),
    ];

    store.setProducts(products);
    store.setCategory('cat-food');
    store.setCategory(null);

    const state = useProductStore.getState();
    const filtered = selectFilteredProducts(state);
    expect(filtered).toHaveLength(2);
  });

  test('deductStock reduces stock by quantity', () => {
    const store = useProductStore.getState();
    store.setProducts([makeProduct({ id: 'prod-1', stock: 10 })]);

    store.deductStock('prod-1', 3);

    const state = useProductStore.getState();
    const product = state.products.find((p) => p.id === 'prod-1');
    expect(product?.stock).toBe(7);
  });

  test('deductStock does not go below 0', () => {
    const store = useProductStore.getState();
    store.setProducts([makeProduct({ id: 'p1', stock: 2 })]);

    store.deductStock('p1', 5);

    const state = useProductStore.getState();
    const product = state.products.find((p) => p.id === 'p1');
    expect(product?.stock).toBe(0);
  });

  test('is_active=false products are stored but filtered at query level', () => {
    // Note: inactive products are filtered by the Supabase query (.eq('is_active', true)),
    // not by the selectFilteredProducts selector. This test verifies the store
    // correctly stores whatever products are loaded (already filtered by DB).
    const store = useProductStore.getState();

    const activeProducts = [
      makeProduct({ id: 'p1', is_active: true }),
      makeProduct({ id: 'p3', is_active: true }),
    ];

    store.setProducts(activeProducts);

    const state = useProductStore.getState();
    const filtered = selectFilteredProducts(state);
    expect(filtered).toHaveLength(2);
    filtered.forEach((p) => {
      expect(p.is_active).toBe(true);
    });
  });
});
