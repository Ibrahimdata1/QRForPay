// Mock Supabase client — must be declared before any imports that use it
const mockFrom = jest.fn();
const mockInsert = jest.fn();
const mockSelect = jest.fn();
const mockUpdate = jest.fn();
const mockEq = jest.fn();
const mockIn = jest.fn();
const mockOrder = jest.fn();
const mockSingle = jest.fn();
const mockRpc = jest.fn();

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
    rpc: (...args: any[]) => mockRpc(...args),
  },
}));

import { useIngredientStore } from '../src/store/ingredientStore';
import { Ingredient, CartItem, Product } from '../src/types';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeIngredient(overrides: Partial<Ingredient> = {}): Ingredient {
  return {
    id: 'ing-1',
    shop_id: 'shop-1',
    name: 'Flour',
    unit: 'kg',
    current_stock: 10,
    min_threshold: 2,
    cost_per_unit: 30,
    expiry_date: null,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    shop_id: 'shop-1',
    category_id: 'cat-1',
    name: 'Bread',
    price: 50,
    stock: 20,
    is_active: true,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeCartItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    product: makeProduct(),
    quantity: 2,
    subtotal: 100,
    ...overrides,
  };
}

/** Build a full supabase chain mock */
function setupMockChain() {
  const eqChain: any = {
    eq: mockEq,
    order: mockOrder,
    single: mockSingle,
    in: mockIn,
  };
  mockEq.mockReturnValue(eqChain);
  mockIn.mockResolvedValue({ data: [], error: null });
  mockOrder.mockReturnValue(eqChain);
  mockSingle.mockResolvedValue({ data: null, error: null });
  mockSelect.mockReturnValue(eqChain);
  mockInsert.mockResolvedValue({ data: null, error: null });
  mockUpdate.mockReturnValue(eqChain);

  mockFrom.mockReturnValue({
    insert: mockInsert,
    select: mockSelect,
    update: mockUpdate,
  });

  mockRpc.mockResolvedValue({ error: null });
}

function resetStore() {
  useIngredientStore.setState({ ingredients: [], isLoading: false });
}

// ─── fetchIngredients ─────────────────────────────────────────────────────────

describe('IngredientStore — fetchIngredients', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMockChain();
    resetStore();
  });

  test('happy path: populates state with returned data', async () => {
    const mockIngredients = [makeIngredient(), makeIngredient({ id: 'ing-2', name: 'Sugar' })];
    // Chain: from('ingredients').select('*').eq(…).eq(…).order('name') resolves
    mockOrder.mockResolvedValueOnce({ data: mockIngredients, error: null });

    await useIngredientStore.getState().fetchIngredients('shop-1');

    const state = useIngredientStore.getState();
    expect(state.ingredients).toHaveLength(2);
    expect(state.ingredients[0].name).toBe('Flour');
    expect(state.isLoading).toBe(false);
  });

  test('DB error: sets isLoading false and keeps ingredients empty', async () => {
    mockOrder.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

    await useIngredientStore.getState().fetchIngredients('shop-1');

    const state = useIngredientStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.ingredients).toHaveLength(0);
  });

  test('exception thrown: isLoading still resets to false', async () => {
    mockOrder.mockRejectedValueOnce(new Error('Network failure'));

    await useIngredientStore.getState().fetchIngredients('shop-1');

    expect(useIngredientStore.getState().isLoading).toBe(false);
  });
});

// ─── saveIngredient ───────────────────────────────────────────────────────────

describe('IngredientStore — saveIngredient (add / edit)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMockChain();
    resetStore();
  });

  test('insert path: calls insert and pushes ingredient to state', async () => {
    const inserted = makeIngredient({ id: 'new-ing' });
    mockInsert.mockReturnValueOnce({ select: mockSelect });
    mockSingle.mockResolvedValueOnce({ data: inserted, error: null });

    await useIngredientStore.getState().saveIngredient('shop-1', {
      name: 'Flour',
      unit: 'kg',
      current_stock: 10,
      min_threshold: 2,
      cost_per_unit: 30,
    });

    expect(mockFrom).toHaveBeenCalledWith('ingredients');
    expect(mockInsert).toHaveBeenCalled();
    const insertArg = mockInsert.mock.calls[0][0];
    expect(insertArg).toHaveProperty('name', 'Flour');
    expect(insertArg).toHaveProperty('is_active', true);

    const state = useIngredientStore.getState();
    expect(state.ingredients).toHaveLength(1);
    expect(state.ingredients[0].id).toBe('new-ing');
  });

  test('insert path: defaults current_stock / min_threshold / cost_per_unit to 0', async () => {
    const inserted = makeIngredient({ id: 'new-ing', current_stock: 0, min_threshold: 0, cost_per_unit: 0 });
    mockInsert.mockReturnValueOnce({ select: mockSelect });
    mockSingle.mockResolvedValueOnce({ data: inserted, error: null });

    await useIngredientStore.getState().saveIngredient('shop-1', { name: 'Salt', unit: 'g' });

    const insertArg = mockInsert.mock.calls[0][0];
    expect(insertArg.current_stock).toBe(0);
    expect(insertArg.min_threshold).toBe(0);
    expect(insertArg.cost_per_unit).toBe(0);
  });

  test('insert path: expiry_date defaults to null when omitted', async () => {
    const inserted = makeIngredient({ id: 'new-ing' });
    mockInsert.mockReturnValueOnce({ select: mockSelect });
    mockSingle.mockResolvedValueOnce({ data: inserted, error: null });

    await useIngredientStore.getState().saveIngredient('shop-1', { name: 'Oil', unit: 'L' });

    const insertArg = mockInsert.mock.calls[0][0];
    expect(insertArg.expiry_date).toBeNull();
  });

  test('insert path: throws on DB error', async () => {
    mockInsert.mockReturnValueOnce({ select: mockSelect });
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'insert failed' } });

    await expect(
      useIngredientStore.getState().saveIngredient('shop-1', { name: 'Salt', unit: 'g' })
    ).rejects.toMatchObject({ message: 'insert failed' });
  });

  test('update path: calls update and patches ingredient in state', async () => {
    useIngredientStore.setState({ ingredients: [makeIngredient()], isLoading: false });
    mockEq.mockResolvedValueOnce({ error: null });

    await useIngredientStore.getState().saveIngredient('shop-1', {
      id: 'ing-1',
      name: 'Whole Wheat Flour',
      unit: 'kg',
      current_stock: 5,
      min_threshold: 1,
      cost_per_unit: 40,
    });

    expect(mockUpdate).toHaveBeenCalled();
    expect(useIngredientStore.getState().ingredients[0].name).toBe('Whole Wheat Flour');
  });

  test('update path: throws on DB error', async () => {
    useIngredientStore.setState({ ingredients: [makeIngredient()], isLoading: false });
    mockEq.mockResolvedValueOnce({ error: { message: 'update failed' } });

    await expect(
      useIngredientStore.getState().saveIngredient('shop-1', { id: 'ing-1', name: 'X', unit: 'kg' })
    ).rejects.toMatchObject({ message: 'update failed' });
  });
});

// ─── deleteIngredient ─────────────────────────────────────────────────────────

describe('IngredientStore — deleteIngredient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMockChain();
    resetStore();
  });

  test('soft-deletes (is_active=false) and removes from local state', async () => {
    useIngredientStore.setState({
      ingredients: [makeIngredient(), makeIngredient({ id: 'ing-2' })],
      isLoading: false,
    });
    mockEq.mockResolvedValueOnce({ error: null });

    await useIngredientStore.getState().deleteIngredient('ing-1');

    expect(mockUpdate).toHaveBeenCalledWith({ is_active: false });
    const state = useIngredientStore.getState();
    expect(state.ingredients).toHaveLength(1);
    expect(state.ingredients[0].id).toBe('ing-2');
  });

  test('throws on DB error', async () => {
    useIngredientStore.setState({ ingredients: [makeIngredient()], isLoading: false });
    mockEq.mockResolvedValueOnce({ error: { message: 'delete failed' } });

    await expect(
      useIngredientStore.getState().deleteIngredient('ing-1')
    ).rejects.toMatchObject({ message: 'delete failed' });
  });
});

// ─── adjustStock ─────────────────────────────────────────────────────────────

describe('IngredientStore — adjustStock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMockChain();
    useIngredientStore.setState({
      ingredients: [makeIngredient({ current_stock: 10 })],
      isLoading: false,
    });
  });

  test('stock_in: takes absolute value of qty as positive delta', async () => {
    // rpc resolves ok → then fetch updated stock
    mockRpc.mockResolvedValueOnce({ error: null });
    mockSingle.mockResolvedValueOnce({ data: { current_stock: 15 }, error: null });

    await useIngredientStore.getState().adjustStock('shop-1', 'ing-1', 5, 'stock_in', 'delivery');

    expect(mockRpc).toHaveBeenCalledWith('adjust_stock', expect.objectContaining({
      p_delta: 5,
      p_type: 'stock_in',
    }));
    expect(useIngredientStore.getState().ingredients[0].current_stock).toBe(15);
  });

  test('stock_in with negative qty: delta becomes positive (Math.abs)', async () => {
    mockRpc.mockResolvedValueOnce({ error: null });
    mockSingle.mockResolvedValueOnce({ data: { current_stock: 15 }, error: null });

    await useIngredientStore.getState().adjustStock('shop-1', 'ing-1', -5, 'stock_in');

    expect(mockRpc).toHaveBeenCalledWith('adjust_stock', expect.objectContaining({
      p_delta: 5, // abs(-5) = 5
    }));
  });

  test('waste: passes signed (negative) qty directly as delta', async () => {
    mockRpc.mockResolvedValueOnce({ error: null });
    mockSingle.mockResolvedValueOnce({ data: { current_stock: 7 }, error: null });

    await useIngredientStore.getState().adjustStock('shop-1', 'ing-1', -3, 'waste');

    expect(mockRpc).toHaveBeenCalledWith('adjust_stock', expect.objectContaining({
      p_delta: -3,
      p_type: 'waste',
    }));
    expect(useIngredientStore.getState().ingredients[0].current_stock).toBe(7);
  });

  test('adjustment: positive signed qty passed through unchanged', async () => {
    mockRpc.mockResolvedValueOnce({ error: null });
    mockSingle.mockResolvedValueOnce({ data: { current_stock: 8 }, error: null });

    await useIngredientStore.getState().adjustStock('shop-1', 'ing-1', 3, 'adjustment');

    expect(mockRpc).toHaveBeenCalledWith('adjust_stock', expect.objectContaining({
      p_delta: 3,
      p_type: 'adjustment',
    }));
  });

  test('updates local state with the DB-authoritative stock value', async () => {
    mockRpc.mockResolvedValueOnce({ error: null });
    // DB returns 42 as the authoritative new stock (DB enforces floor at 0)
    mockSingle.mockResolvedValueOnce({ data: { current_stock: 42 }, error: null });

    await useIngredientStore.getState().adjustStock('shop-1', 'ing-1', 99, 'stock_in');

    expect(useIngredientStore.getState().ingredients[0].current_stock).toBe(42);
  });

  test('throws when rpc call fails', async () => {
    mockRpc.mockResolvedValueOnce({ error: { message: 'rpc failed' } });

    await expect(
      useIngredientStore.getState().adjustStock('shop-1', 'ing-1', 5, 'stock_in')
    ).rejects.toMatchObject({ message: 'rpc failed' });
  });

  test('throws when fetch of updated stock fails', async () => {
    mockRpc.mockResolvedValueOnce({ error: null });
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'fetch failed' } });

    await expect(
      useIngredientStore.getState().adjustStock('shop-1', 'ing-1', 5, 'stock_in')
    ).rejects.toMatchObject({ message: 'fetch failed' });
  });

  test('passes note and shopId through to rpc', async () => {
    mockRpc.mockResolvedValueOnce({ error: null });
    mockSingle.mockResolvedValueOnce({ data: { current_stock: 10 }, error: null });

    await useIngredientStore.getState().adjustStock('shop-1', 'ing-1', 2, 'stock_in', 'delivery note');

    expect(mockRpc).toHaveBeenCalledWith('adjust_stock', expect.objectContaining({
      p_note: 'delivery note',
      p_shop_id: 'shop-1',
    }));
  });
});

// ─── deductForOrder ───────────────────────────────────────────────────────────

describe('IngredientStore — deductForOrder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMockChain();
    useIngredientStore.setState({
      ingredients: [
        makeIngredient({ id: 'ing-1', current_stock: 20 }),
        makeIngredient({ id: 'ing-2', current_stock: 15 }),
      ],
      isLoading: false,
    });
  });

  test('returns immediately when items array is empty', async () => {
    await useIngredientStore.getState().deductForOrder('shop-1', 'order-1', []);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  test('calls rpc adjust_stock for each ingredient derived from recipes', async () => {
    const item = makeCartItem({ quantity: 2 });
    const recipes = [{ ingredient_id: 'ing-1', quantity_per_unit: 0.5 }];

    // recipes fetch: from('recipes').select(…).eq('product_id', 'prod-1')
    mockEq.mockResolvedValueOnce({ data: recipes, error: null });

    // rpc call for ing-1 with delta = -(2 * 0.5) = -1
    mockRpc.mockResolvedValueOnce({ error: null });

    // refresh: from('ingredients').select('id,current_stock').in('id', ['ing-1'])
    mockIn.mockResolvedValueOnce({
      data: [{ id: 'ing-1', current_stock: 19 }],
      error: null,
    });

    await useIngredientStore.getState().deductForOrder('shop-1', 'order-1', [item]);

    expect(mockRpc).toHaveBeenCalledWith('adjust_stock', expect.objectContaining({
      p_ingredient_id: 'ing-1',
      p_delta: -1,
      p_type: 'auto_deduct',
      p_reference_order_id: 'order-1',
      p_shop_id: 'shop-1',
    }));
    expect(useIngredientStore.getState().ingredients[0].current_stock).toBe(19);
  });

  test('skips product if it has no recipes', async () => {
    const item = makeCartItem({ quantity: 3 });
    mockEq.mockResolvedValueOnce({ data: [], error: null }); // no recipes

    await useIngredientStore.getState().deductForOrder('shop-1', 'order-1', [item]);

    expect(mockRpc).not.toHaveBeenCalled();
  });

  test('accumulates deltas across multiple items for the same ingredient', async () => {
    const item1 = makeCartItem({ quantity: 1 });
    const item2 = makeCartItem({ product: makeProduct({ id: 'prod-2' }), quantity: 2, subtotal: 100 });

    const recipeProd1 = [{ ingredient_id: 'ing-1', quantity_per_unit: 1 }];
    const recipeProd2 = [{ ingredient_id: 'ing-1', quantity_per_unit: 2 }];

    mockEq
      .mockResolvedValueOnce({ data: recipeProd1, error: null }) // prod-1 recipes
      .mockResolvedValueOnce({ data: recipeProd2, error: null }); // prod-2 recipes

    // total delta: 1*1 + 2*2 = 5 → p_delta = -5
    mockRpc.mockResolvedValueOnce({ error: null });
    mockIn.mockResolvedValueOnce({ data: [{ id: 'ing-1', current_stock: 15 }], error: null });

    await useIngredientStore.getState().deductForOrder('shop-1', 'order-1', [item1, item2]);

    expect(mockRpc).toHaveBeenCalledWith('adjust_stock', expect.objectContaining({
      p_delta: -5,
    }));
    expect(useIngredientStore.getState().ingredients[0].current_stock).toBe(15);
  });

  test('throws when recipes fetch fails', async () => {
    const item = makeCartItem({ quantity: 1 });
    mockEq.mockResolvedValueOnce({ data: null, error: { message: 'recipe error' } });

    await expect(
      useIngredientStore.getState().deductForOrder('shop-1', 'order-1', [item])
    ).rejects.toMatchObject({ message: 'recipe error' });
  });

  test('throws when the refreshed stock fetch fails', async () => {
    const item = makeCartItem({ quantity: 1 });
    mockEq.mockResolvedValueOnce({ data: [{ ingredient_id: 'ing-1', quantity_per_unit: 1 }], error: null });
    mockRpc.mockResolvedValueOnce({ error: null });
    mockIn.mockResolvedValueOnce({ data: null, error: { message: 'stock fetch error' } });

    await expect(
      useIngredientStore.getState().deductForOrder('shop-1', 'order-1', [item])
    ).rejects.toMatchObject({ message: 'stock fetch error' });
  });
});
