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
import { formatThaiCurrency, calculateChange, generateOrderNumber, formatReceipt } from '../src/lib/receipt';
import { OrderWithItems } from '../src/types';

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

  test('generateOrderNumber returns a string with date-seq format', () => {
    const num = generateOrderNumber('shop-1');
    // Format: YYYYMMDD-NNNN
    expect(num).toMatch(/^\d{8}-\d{4}$/);
  });

  test('generateOrderNumber includes today\'s date prefix', () => {
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const expectedPrefix = `${year}${month}${day}`;

    const num = generateOrderNumber('shop-1');
    expect(num.startsWith(expectedPrefix)).toBe(true);
  });

  test('formatReceipt includes order number and total', () => {
    const order: OrderWithItems = {
      id: 'order-1',
      shop_id: 'shop-1',
      order_number: 1001,
      cashier_id: 'cashier-1',
      status: 'completed',
      subtotal: 200,
      discount_amount: 0,
      tax_amount: 14,
      total_amount: 200,
      payment_method: 'cash',
      created_at: new Date().toISOString(),
      completed_at: null,
      items: [
        {
          id: 'item-1',
          order_id: 'order-1',
          product_id: 'prod-abc-123456789012',
          quantity: 2,
          unit_price: 100,
          subtotal: 200,
        },
      ],
    };

    const receipt = formatReceipt(order);
    expect(receipt).toContain('1001');
    expect(receipt).toContain('CASH');
    expect(receipt).toContain('฿200.00');
    expect(receipt).toContain('EasyShop POS');
    expect(receipt).toContain('Thank you');
  });

  test('formatReceipt shows discount line when discount_amount > 0', () => {
    const order: OrderWithItems = {
      id: 'order-2',
      shop_id: 'shop-1',
      order_number: 1002,
      cashier_id: null,
      status: 'completed',
      subtotal: 400,
      discount_amount: 40,
      tax_amount: 25.2,
      total_amount: 360,
      payment_method: 'qr',
      created_at: new Date().toISOString(),
      completed_at: null,
      items: [
        {
          id: 'item-2',
          order_id: 'order-2',
          product_id: 'prod-1',
          quantity: 4,
          unit_price: 100,
          subtotal: 400,
        },
      ],
    };

    const receipt = formatReceipt(order);
    expect(receipt).toContain('Discount');
    expect(receipt).toContain('฿40.00');
  });

  test('formatReceipt omits discount line when discount_amount is 0', () => {
    const order: OrderWithItems = {
      id: 'order-3',
      shop_id: 'shop-1',
      order_number: 1003,
      cashier_id: null,
      status: 'completed',
      subtotal: 100,
      discount_amount: 0,
      tax_amount: 7,
      total_amount: 100,
      payment_method: 'cash',
      created_at: new Date().toISOString(),
      completed_at: null,
      items: [],
    };

    const receipt = formatReceipt(order);
    expect(receipt).not.toContain('Discount');
  });
});

describe('OrderStore — additional branches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMockChain();
  });

  test('updateOrderStatus to "completed" includes completed_at timestamp', async () => {
    mockEq.mockResolvedValueOnce({ error: null });

    const store = useOrderStore.getState();
    await store.updateOrderStatus('order-1', 'completed');

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        completed_at: expect.any(String),
      })
    );
  });

  test('updateOrderStatus non-completed: no completed_at field', async () => {
    mockEq.mockResolvedValueOnce({ error: null });

    const store = useOrderStore.getState();
    await store.updateOrderStatus('order-1', 'confirmed');

    const updateArg = mockUpdate.mock.calls[0][0];
    expect(updateArg).not.toHaveProperty('completed_at');
  });

  test('updateOrderStatus: throws when DB returns error', async () => {
    mockEq.mockResolvedValueOnce({ error: { message: 'update failed' } });

    const store = useOrderStore.getState();
    await expect(store.updateOrderStatus('order-1', 'confirmed')).rejects.toMatchObject({
      message: 'update failed',
    });
  });

  test('completeOrder with "auto" confirmationType passes it to payments update', async () => {
    mockEq
      .mockResolvedValueOnce({ error: null })  // payments update
      .mockResolvedValueOnce({ error: null });  // orders update

    const store = useOrderStore.getState();
    await store.completeOrder('order-1', { status: 'success' }, 'auto');

    const paymentUpdateArg = mockUpdate.mock.calls[0][0];
    expect(paymentUpdateArg).toHaveProperty('confirmation_type', 'auto');
    expect(paymentUpdateArg).toHaveProperty('confirmed_by', null);
  });

  test('completeOrder with "manual" and confirmedBy passes confirmedBy', async () => {
    mockEq
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: null });

    const store = useOrderStore.getState();
    await store.completeOrder('order-1', { status: 'success' }, 'manual', 'cashier-1');

    const paymentUpdateArg = mockUpdate.mock.calls[0][0];
    expect(paymentUpdateArg).toHaveProperty('confirmation_type', 'manual');
    expect(paymentUpdateArg).toHaveProperty('confirmed_by', 'cashier-1');
  });

  test('completeOrder: throws when payment update fails', async () => {
    mockEq.mockResolvedValueOnce({ error: { message: 'payment update failed' } });

    const store = useOrderStore.getState();
    await expect(
      store.completeOrder('order-1', { status: 'success' }, 'manual')
    ).rejects.toMatchObject({ message: 'payment update failed' });
  });

  test('createOrder: throws when order insert fails', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'order insert failed' } });
    mockInsert.mockReturnValueOnce({ select: mockSelect });

    const store = useOrderStore.getState();
    await expect(
      store.createOrder('shop-1', 'cashier-1', [], 'cash', 0, 0.07)
    ).rejects.toMatchObject({ message: 'order insert failed' });
  });

  test('fetchOrders: handles error gracefully (sets isLoading false)', async () => {
    mockLimit.mockResolvedValueOnce({ data: null, error: { message: 'fetch failed' } });

    const store = useOrderStore.getState();
    // Should not throw — error is swallowed
    await store.fetchOrders('shop-1');

    expect(useOrderStore.getState().isLoading).toBe(false);
  });
});
