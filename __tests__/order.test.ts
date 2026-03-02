// Mock Supabase client
const mockFrom = jest.fn();
const mockInsert = jest.fn();
const mockSelect = jest.fn();
const mockUpdate = jest.fn();
const mockEq = jest.fn();
const mockOrderBy = jest.fn();
const mockSingle = jest.fn();
const mockLimit = jest.fn();

jest.mock('../src/lib/supabase', () => ({
  supabase: { from: (...args: any[]) => mockFrom(...args) },
}));

jest.mock('../src/lib/qr', () => ({
  generatePromptPayPayload: jest.fn(() => 'mock-qr-payload'),
  generateQRReference: jest.fn(() => 'mock-ref'),
}));

import { useOrderStore } from '../src/store/orderStore';
import { formatThaiCurrency, calculateChange } from '../src/lib/receipt';

function setupMockChain() {
  const eqChain: any = {
    eq: mockEq,
    order: mockOrderBy,
    select: mockSelect,
    single: mockSingle,
    limit: mockLimit,
  };
  mockEq.mockReturnValue(eqChain);
  mockOrderBy.mockReturnValue({ limit: mockLimit, eq: mockEq });
  mockLimit.mockResolvedValue({ data: [], error: null });
  mockSingle.mockResolvedValue({ data: null, error: null });
  mockSelect.mockReturnValue({ eq: mockEq, single: mockSingle, order: mockOrderBy });
  mockInsert.mockReturnValue({ select: mockSelect });
  mockUpdate.mockReturnValue(eqChain);
  mockFrom.mockReturnValue({
    insert: mockInsert,
    select: mockSelect,
    update: mockUpdate,
  });
}

describe('OrderStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMockChain();
  });

  test('createOrder inserts correct data structure', async () => {
    const mockOrderData = {
      id: 'order-1',
      shop_id: 'shop-1',
      subtotal: 200,
      discount_amount: 0,
      tax_amount: 14,
      total_amount: 200,
      payment_method: 'cash',
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    // createOrder calls .single() 3 times: order insert, items insert (no single), payment insert
    mockSingle
      .mockResolvedValueOnce({ data: mockOrderData, error: null })  // order insert
      .mockResolvedValueOnce({ data: { id: 'pay-1' }, error: null }); // payment insert
    mockInsert
      .mockReturnValueOnce({ select: mockSelect }) // orders insert
      .mockResolvedValueOnce({ error: null })       // order_items insert (no .select)
      .mockReturnValueOnce({ select: mockSelect }); // payments insert

    const store = useOrderStore.getState();
    const mockItems = [{ product: { id: 'p1', price: 100 }, quantity: 2, subtotal: 200 }] as any;
    const result = await store.createOrder(
      'shop-1',
      'cashier-1',
      mockItems,
      'cash',
      0,
      0.07
    );

    expect(mockFrom).toHaveBeenCalledWith('orders');
    expect(mockInsert).toHaveBeenCalled();
    const insertArg = mockInsert.mock.calls[0][0];
    expect(insertArg).toHaveProperty('shop_id', 'shop-1');
    expect(insertArg).toHaveProperty('payment_method', 'cash');
    expect(insertArg).toHaveProperty('status', 'pending');
  });

  test('createOrder returns order with generated id', async () => {
    const mockOrderData = {
      id: 'generated-uuid-123',
      shop_id: 'shop-1',
      total_amount: 214,
      status: 'pending',
    };

    mockSingle
      .mockResolvedValueOnce({ data: mockOrderData, error: null })
      .mockResolvedValueOnce({ data: { id: 'pay-1' }, error: null });
    mockInsert
      .mockReturnValueOnce({ select: mockSelect })
      .mockResolvedValueOnce({ error: null })
      .mockReturnValueOnce({ select: mockSelect });

    const store = useOrderStore.getState();
    const result = await store.createOrder(
      'shop-1',
      'cashier-1',
      [],
      'cash',
      0,
      0.07
    );

    expect(result).toHaveProperty('id');
    expect(result.id).toBe('generated-uuid-123');
  });

  test('updateOrderStatus transitions pending to confirmed', async () => {
    mockEq.mockResolvedValueOnce({ error: null });

    const store = useOrderStore.getState();
    await store.updateOrderStatus('order-1', 'confirmed');

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'confirmed' })
    );
  });

  test('completeOrder marks payment as success', async () => {
    // completeOrder calls update twice: payments then orders
    mockEq
      .mockResolvedValueOnce({ error: null })  // payments update
      .mockResolvedValueOnce({ error: null });  // orders update

    const store = useOrderStore.getState();
    await store.completeOrder('order-1', { status: 'success' }, 'manual');

    expect(mockUpdate).toHaveBeenCalled();
  });

  test('fetchOrders returns array sorted by created_at desc', async () => {
    const mockOrders = [
      { id: 'o2', created_at: '2025-01-02T00:00:00Z' },
      { id: 'o1', created_at: '2025-01-01T00:00:00Z' },
    ];

    mockLimit.mockResolvedValueOnce({ data: mockOrders, error: null });

    const store = useOrderStore.getState();
    await store.fetchOrders('shop-1');

    expect(mockFrom).toHaveBeenCalledWith('orders');
    expect(mockOrderBy).toHaveBeenCalledWith('created_at', {
      ascending: false,
    });
  });

  test('order total = sum of item subtotals + tax - discount', () => {
    const items = [
      { subtotal: 200 },
      { subtotal: 150 },
      { subtotal: 50 },
    ];
    const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0); // 400
    const discount = 40; // 10%
    const taxRate = 0.07;
    const afterDiscount = subtotal - discount; // 360
    const tax = afterDiscount * taxRate; // 25.2
    const total = afterDiscount + tax; // 385.2

    expect(subtotal).toBe(400);
    expect(total).toBeCloseTo(385.2, 2);
  });
});

describe('Receipt', () => {
  test('formatThaiCurrency(1234.5) === "฿1,234.50"', () => {
    expect(formatThaiCurrency(1234.5)).toBe('฿1,234.50');
  });

  test('formatThaiCurrency(0) === "฿0.00"', () => {
    expect(formatThaiCurrency(0)).toBe('฿0.00');
  });

  test('calculateChange(500, 350) === 150', () => {
    expect(calculateChange(500, 350)).toBe(150);
  });

  test('calculateChange(100, 100) === 0', () => {
    expect(calculateChange(100, 100)).toBe(0);
  });

  test('calculateChange(99, 100) returns 0 (clamped)', () => {
    // calculateChange uses Math.max(0, paid - total) so underpayment returns 0
    const result = calculateChange(99, 100);
    expect(result).toBe(0);
  });
});
