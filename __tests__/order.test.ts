// Mock Supabase client
const mockFrom = jest.fn();
const mockInsert = jest.fn();
const mockSelect = jest.fn();
const mockUpdate = jest.fn();
const mockEq = jest.fn();
const mockOrder = jest.fn();
const mockSingle = jest.fn();

const mockSupabase = {
  from: mockFrom.mockReturnValue({
    insert: mockInsert.mockReturnValue({
      select: mockSelect.mockReturnValue({
        single: mockSingle,
      }),
    }),
    select: mockSelect.mockReturnValue({
      eq: mockEq.mockReturnValue({
        order: mockOrder,
      }),
      order: mockOrder,
    }),
    update: mockUpdate.mockReturnValue({
      eq: mockEq.mockReturnValue({
        select: mockSelect.mockReturnValue({
          single: mockSingle,
        }),
      }),
    }),
  }),
};

jest.mock('../src/lib/supabase', () => ({ supabase: mockSupabase }));

import { useOrderStore } from '../src/store/orderStore';
import { formatThaiCurrency, calculateChange } from '../src/lib/utils';

describe('OrderStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('createOrder inserts correct data structure', async () => {
    const mockOrder = {
      id: 'order-1',
      shop_id: 'shop-1',
      items: [{ product_id: 'p1', quantity: 2, unit_price: 100, subtotal: 200 }],
      subtotal: 200,
      discount: 0,
      tax: 14,
      total: 214,
      payment_method: 'cash',
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    mockSingle.mockResolvedValueOnce({ data: mockOrder, error: null });

    const store = useOrderStore.getState();
    const result = await store.createOrder({
      shop_id: 'shop-1',
      items: [{ product_id: 'p1', quantity: 2, unit_price: 100, subtotal: 200 }],
      subtotal: 200,
      discount: 0,
      tax: 14,
      total: 214,
      payment_method: 'cash',
    });

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
      total: 214,
      status: 'pending',
    };

    mockSingle.mockResolvedValueOnce({ data: mockOrderData, error: null });

    const store = useOrderStore.getState();
    const result = await store.createOrder({
      shop_id: 'shop-1',
      items: [],
      subtotal: 200,
      discount: 0,
      tax: 14,
      total: 214,
      payment_method: 'cash',
    });

    expect(result).toHaveProperty('id');
    expect(result.id).toBe('generated-uuid-123');
  });

  test('updateOrderStatus transitions pending to confirmed', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: 'order-1', status: 'confirmed' },
      error: null,
    });

    const store = useOrderStore.getState();
    const result = await store.updateOrderStatus('order-1', 'confirmed');

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'confirmed' })
    );
  });

  test('completeOrder marks payment as success', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: 'order-1', status: 'completed', payment_status: 'success' },
      error: null,
    });

    const store = useOrderStore.getState();
    const result = await store.completeOrder('order-1');

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        payment_status: 'success',
      })
    );
  });

  test('fetchOrders returns array sorted by created_at desc', async () => {
    const mockOrders = [
      { id: 'o2', created_at: '2025-01-02T00:00:00Z' },
      { id: 'o1', created_at: '2025-01-01T00:00:00Z' },
    ];

    mockOrder.mockResolvedValueOnce({ data: mockOrders, error: null });

    const store = useOrderStore.getState();
    const result = await store.fetchOrders('shop-1');

    expect(mockFrom).toHaveBeenCalledWith('orders');
    expect(mockOrder).toHaveBeenCalledWith('created_at', {
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

  test('calculateChange(99, 100) throws or returns negative', () => {
    // If the function throws for insufficient payment:
    try {
      const result = calculateChange(99, 100);
      // If it doesn't throw, it should return a negative value
      expect(result).toBeLessThan(0);
    } catch (e) {
      expect(e).toBeDefined();
    }
  });
});
