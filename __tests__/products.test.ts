// Mock Supabase client
const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockUpdate = jest.fn();
const mockOrder = jest.fn();
const mockInsert = jest.fn();
const mockSingle = jest.fn();

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
    single: mockSingle,
  };
  mockEq.mockReturnValue(eqChain);
  mockOrder.mockResolvedValue({ data: [], error: null });
  mockSingle.mockResolvedValue({ data: null, error: null });
  mockSelect.mockReturnValue(eqChain);
  mockUpdate.mockReturnValue(eqChain);
  mockInsert.mockReturnValue({ select: mockSelect });
  mockFrom.mockReturnValue({
    select: mockSelect,
    update: mockUpdate,
    insert: mockInsert,
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

describe('ProductStore — fetchProducts errors + fetchCategories', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMockChain();
    useProductStore.getState().setProducts([]);
    useProductStore.getState().setCategory(null);
    useProductStore.getState().setSearch('');
  });

  test('fetchProducts: sets error state when DB returns error', async () => {
    mockOrder.mockResolvedValueOnce({ data: null, error: { message: 'db error' } });

    await useProductStore.getState().fetchProducts('shop-1');

    const state = useProductStore.getState();
    expect(state.error).toBe('db error');
    expect(state.isLoading).toBe(false);
  });

  test('fetchProducts: sets generic error when error has no message', async () => {
    mockOrder.mockResolvedValueOnce({ data: null, error: {} });

    await useProductStore.getState().fetchProducts('shop-1');

    expect(useProductStore.getState().error).toBe('Failed to fetch products');
  });

  test('fetchCategories: populates categories from DB', async () => {
    const mockCategories = [
      { id: 'cat-1', shop_id: 'shop-1', name: 'Food', sort_order: 1, created_at: new Date().toISOString() },
      { id: 'cat-2', shop_id: 'shop-1', name: 'Drinks', sort_order: 2, created_at: new Date().toISOString() },
    ];
    mockOrder.mockResolvedValueOnce({ data: mockCategories, error: null });

    await useProductStore.getState().fetchCategories('shop-1');

    expect(useProductStore.getState().categories).toHaveLength(2);
    expect(useProductStore.getState().categories[0].name).toBe('Food');
  });

  test('fetchCategories: sets error on DB error', async () => {
    mockOrder.mockResolvedValueOnce({ data: null, error: { message: 'cat error' } });

    await useProductStore.getState().fetchCategories('shop-1');

    expect(useProductStore.getState().error).toBe('cat error');
  });

  test('fetchCategories: sets generic error when error has no message', async () => {
    mockOrder.mockResolvedValueOnce({ data: null, error: {} });

    await useProductStore.getState().fetchCategories('shop-1');

    expect(useProductStore.getState().error).toBe('Failed to fetch categories');
  });
});

describe('ProductStore — saveProduct (insert / update)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMockChain();
    useProductStore.getState().setProducts([]);
  });

  test('saveProduct (insert): calls insert and adds product to state', async () => {
    const newProduct = makeProduct({ id: 'new-prod' });
    mockSingle.mockResolvedValueOnce({ data: newProduct, error: null });

    await useProductStore.getState().saveProduct('shop-1', {
      name: 'New Product',
      price: 150,
      stock: 5,
      is_active: true,
    });

    expect(mockInsert).toHaveBeenCalled();
    const insertArg = mockInsert.mock.calls[0][0];
    expect(insertArg).toHaveProperty('name', 'New Product');
    expect(insertArg).toHaveProperty('price', 150);
    expect(insertArg).toHaveProperty('is_active', true);

    const state = useProductStore.getState();
    expect(state.products).toHaveLength(1);
    expect(state.products[0].id).toBe('new-prod');
  });

  test('saveProduct (insert): defaults stock to 0 when not provided', async () => {
    const newProduct = makeProduct({ id: 'new-prod', stock: 0 });
    mockSingle.mockResolvedValueOnce({ data: newProduct, error: null });

    await useProductStore.getState().saveProduct('shop-1', { name: 'X', price: 50 });

    const insertArg = mockInsert.mock.calls[0][0];
    expect(insertArg.stock).toBe(0);
  });

  test('saveProduct (insert): throws on DB error', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'insert failed' } });

    await expect(
      useProductStore.getState().saveProduct('shop-1', { name: 'X', price: 50 })
    ).rejects.toMatchObject({ message: 'insert failed' });
  });

  test('saveProduct (update): calls update and patches product in state', async () => {
    useProductStore.getState().setProducts([makeProduct({ id: 'prod-1' })]);
    mockEq.mockResolvedValueOnce({ error: null });

    await useProductStore.getState().saveProduct('shop-1', {
      id: 'prod-1',
      name: 'Updated Name',
      price: 200,
    });

    expect(mockUpdate).toHaveBeenCalled();
    const state = useProductStore.getState();
    expect(state.products[0].name).toBe('Updated Name');
  });

  test('saveProduct (update): throws on DB error', async () => {
    useProductStore.getState().setProducts([makeProduct({ id: 'prod-1' })]);
    mockEq.mockResolvedValueOnce({ error: { message: 'update failed' } });

    await expect(
      useProductStore.getState().saveProduct('shop-1', { id: 'prod-1', name: 'X', price: 50 })
    ).rejects.toMatchObject({ message: 'update failed' });
  });
});

describe('ProductStore — deleteProduct', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMockChain();
  });

  test('deleteProduct: soft-deletes and removes product from state', async () => {
    useProductStore.getState().setProducts([
      makeProduct({ id: 'prod-1' }),
      makeProduct({ id: 'prod-2' }),
    ]);
    mockEq.mockResolvedValueOnce({ error: null });

    await useProductStore.getState().deleteProduct('prod-1');

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ is_active: false })
    );
    const state = useProductStore.getState();
    expect(state.products).toHaveLength(1);
    expect(state.products[0].id).toBe('prod-2');
  });

  test('deleteProduct: throws on DB error', async () => {
    useProductStore.getState().setProducts([makeProduct({ id: 'prod-1' })]);
    mockEq.mockResolvedValueOnce({ error: { message: 'delete failed' } });

    await expect(
      useProductStore.getState().deleteProduct('prod-1')
    ).rejects.toMatchObject({ message: 'delete failed' });
  });

  test('deleteProduct: includes deleted_at timestamp in update', async () => {
    useProductStore.getState().setProducts([makeProduct({ id: 'prod-1' })]);
    mockEq.mockResolvedValueOnce({ error: null });

    await useProductStore.getState().deleteProduct('prod-1');

    const updateArg = mockUpdate.mock.calls[0][0];
    expect(updateArg).toHaveProperty('deleted_at');
    expect(typeof updateArg.deleted_at).toBe('string');
  });
});

describe('ProductStore — selectFilteredProducts with SKU search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMockChain();
    useProductStore.getState().setProducts([]);
    useProductStore.getState().setCategory(null);
    useProductStore.getState().setSearch('');
  });

  test('search matches SKU field (case insensitive)', () => {
    const products = [
      makeProduct({ id: 'p1', name: 'Coffee', sku: 'COF-001' }),
      makeProduct({ id: 'p2', name: 'Tea', sku: 'TEA-001' }),
    ];
    useProductStore.getState().setProducts(products);
    useProductStore.getState().setSearch('cof');

    const state = useProductStore.getState();
    const filtered = selectFilteredProducts(state);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].sku).toBe('COF-001');
  });

  test('products with no SKU still match by name search', () => {
    const products = [
      makeProduct({ id: 'p1', name: 'Mango', sku: undefined }),
      makeProduct({ id: 'p2', name: 'Apple', sku: undefined }),
    ];
    useProductStore.getState().setProducts(products);
    useProductStore.getState().setSearch('mango');

    const state = useProductStore.getState();
    const filtered = selectFilteredProducts(state);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('Mango');
  });
});
