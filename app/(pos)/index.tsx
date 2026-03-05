// Live Table Order Monitor
// Staff sees all active customer orders grouped by table in real time.
// Status can be advanced (pending → preparing → ready → completed).
// Emergency manual payment ("รับเงิน") marks payment as confirmed by staff.
//
// Customers place orders via QR code scan → /customer?shop=...&table=...
// Staff does NOT enter orders here.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/store/authStore';
import { useOrderStore } from '../../src/store/orderStore';
import { Colors } from '../../constants/colors';
import { OrderWithItems } from '../../src/types';

// ─── constants ───────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  pending: 'รอดำเนินการ',
  preparing: 'กำลังทำ',
  ready: 'พร้อมเสิร์ฟ',
  completed: 'เสร็จสิ้น',
  cancelled: 'ยกเลิก',
};

const STATUS_COLOR: Record<string, string> = {
  pending: '#F59E0B',
  preparing: '#8B5CF6',
  ready: '#059669',
  completed: '#10B981',
  cancelled: '#EF4444',
};

const NEXT_STATUS: Record<string, string | null> = {
  pending: 'preparing',
  preparing: 'ready',
  ready: 'completed',
  completed: null,
  cancelled: null,
};

const NEXT_LABEL: Record<string, string> = {
  pending: 'เริ่มทำอาหาร',
  preparing: 'พร้อมเสิร์ฟ',
  ready: 'เสร็จสิ้น / ส่งแล้ว',
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  return '฿' + (n ?? 0).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'เมื่อกี้';
  if (diff < 60) return `${diff} นาที`;
  return `${Math.floor(diff / 60)} ชม.`;
}

// ─── component ───────────────────────────────────────────────────────────────

export default function LiveTableMonitor() {
  const shop = useAuthStore((s) => s.shop);
  const profile = useAuthStore((s) => s.profile);
  const updateOrderStatus = useOrderStore((s) => s.updateOrderStatus);
  const completeOrder = useOrderStore((s) => s.completeOrder);

  const [activeOrders, setActiveOrders] = useState<OrderWithItems[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── fetch ──────────────────────────────────────────────────────────────────
  const fetchActive = useCallback(async () => {
    if (!shop?.id) return;
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(
          '*, items:order_items(id, quantity, unit_price, subtotal, product:products(name)), payment:payments(*)'
        )
        .eq('shop_id', shop.id)
        .in('status', ['pending', 'preparing', 'ready'])
        .order('created_at', { ascending: true });

      if (error) throw error;

      setActiveOrders(
        (data ?? []).map((o: any) => {
          const rawPay = Array.isArray(o.payment) ? o.payment[0] : o.payment;
          return { ...o, payment: rawPay ?? undefined } as OrderWithItems;
        })
      );
    } catch (err: any) {
      Alert.alert('โหลดข้อมูลไม่ได้', err?.message ?? 'กรุณาลองใหม่');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [shop?.id]);

  // ── realtime subscription ──────────────────────────────────────────────────
  useEffect(() => {
    if (!shop?.id) return;
    channelRef.current = supabase
      .channel(`monitor:${shop.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `shop_id=eq.${shop.id}` },
        () => { fetchActive(); }
      )
      .subscribe();
    return () => { channelRef.current?.unsubscribe(); };
  }, [shop?.id, fetchActive]);

  // ── focus refresh ──────────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchActive();
    }, [fetchActive])
  );

  // ── actions ────────────────────────────────────────────────────────────────
  const handleAdvance = (order: OrderWithItems) => {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    const label = NEXT_LABEL[order.status];
    Alert.alert(
      label,
      `ออเดอร์ #${order.order_number}${order.table_number ? ` · โต๊ะ ${order.table_number}` : ''}`,
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: label,
          onPress: async () => {
            try {
              await updateOrderStatus(order.id, next);
              fetchActive();
            } catch (err: any) {
              Alert.alert('เกิดข้อผิดพลาด', err?.message);
            }
          },
        },
      ]
    );
  };

  const handleManualPay = (order: OrderWithItems) => {
    Alert.alert(
      'รับเงินสด / ยืนยันชำระ',
      `ยืนยันรับชำระ ${fmt(order.total_amount)} สำหรับออเดอร์ #${order.order_number}${order.table_number ? ` โต๊ะ ${order.table_number}` : ''}`,
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ยืนยันรับเงินแล้ว',
          onPress: async () => {
            try {
              await completeOrder(
                order.id,
                { method: 'cash', amount: order.total_amount ?? 0 },
                'manual',
                profile?.id
              );
              fetchActive();
            } catch (err: any) {
              Alert.alert('เกิดข้อผิดพลาด', err?.message);
            }
          },
        },
      ]
    );
  };

  // ── group by table ─────────────────────────────────────────────────────────
  const groups = activeOrders.reduce<Record<string, OrderWithItems[]>>((acc, o) => {
    const key = o.table_number ?? '__none__';
    if (!acc[key]) acc[key] = [];
    acc[key].push(o);
    return acc;
  }, {});

  const tableKeys = Object.keys(groups).sort((a, b) => {
    if (a === '__none__') return 1;
    if (b === '__none__') return -1;
    const na = parseInt(a), nb = parseInt(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });

  // ── render ─────────────────────────────────────────────────────────────────
  if (isLoading && activeOrders.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>กำลังโหลดออเดอร์...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchActive(); }}
          colors={[Colors.primary]}
          tintColor={Colors.primary}
        />
      }
    >
      {/* Live indicator */}
      <View style={styles.liveRow}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>ออเดอร์สด · {activeOrders.length} รายการ</Text>
        <Text style={styles.liveHint}>ลากลงเพื่อรีเฟรช</Text>
      </View>

      {tableKeys.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="restaurant-outline" size={64} color={Colors.text.light} />
          <Text style={styles.emptyTitle}>ยังไม่มีออเดอร์</Text>
          <Text style={styles.emptySubtitle}>
            ลูกค้าสแกน QR โต๊ะเพื่อสั่งอาหาร{'\n'}
            ออเดอร์จะปรากฏที่นี่โดยอัตโนมัติ
          </Text>
        </View>
      ) : (
        tableKeys.map((key) => {
          const orders = groups[key];
          const tableLabel = key === '__none__' ? 'ไม่ระบุโต๊ะ' : `โต๊ะ ${key}`;
          return (
            <View key={key} style={styles.tableCard}>
              {/* Table header */}
              <View style={styles.tableHeader}>
                <View style={styles.tableHeaderLeft}>
                  <Ionicons name="grid-outline" size={16} color={Colors.primary} />
                  <Text style={styles.tableName}>{tableLabel}</Text>
                </View>
                <Text style={styles.orderCount}>{orders.length} ออเดอร์</Text>
              </View>

              {/* Orders in this table */}
              {orders.map((order, idx) => {
                const sColor = STATUS_COLOR[order.status] ?? '#999';
                const sLabel = STATUS_LABEL[order.status] ?? order.status;
                const nextStatus = NEXT_STATUS[order.status];
                const isPaid = order.payment?.status === 'success';
                const items: any[] = (order as any).items ?? [];
                const isLast = idx === orders.length - 1;

                return (
                  <View
                    key={order.id}
                    style={[styles.orderCard, isLast && styles.orderCardLast]}
                  >
                    {/* Order top row */}
                    <View style={styles.orderTop}>
                      <View style={styles.orderNumRow}>
                        <Text style={styles.orderNum}>#{order.order_number}</Text>
                        <Text style={styles.orderTime}>{timeAgo(order.created_at)}</Text>
                        {order.order_source === 'customer' && (
                          <View style={styles.sourceBadge}>
                            <Text style={styles.sourceBadgeText}>QR</Text>
                          </View>
                        )}
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: sColor + '22', borderColor: sColor },
                        ]}
                      >
                        <Text style={[styles.statusText, { color: sColor }]}>
                          {sLabel}
                        </Text>
                      </View>
                    </View>

                    {/* Items */}
                    <View style={styles.itemsList}>
                      {items.slice(0, 5).map((item: any) => (
                        <Text key={item.id} style={styles.itemRow}>
                          {item.product?.name ?? 'สินค้า'} ×{item.quantity}
                          {'  '}
                          <Text style={styles.itemPrice}>
                            {fmt(item.subtotal)}
                          </Text>
                        </Text>
                      ))}
                      {items.length > 5 && (
                        <Text style={styles.itemMore}>
                          +{items.length - 5} รายการ
                        </Text>
                      )}
                    </View>

                    {/* Total + payment */}
                    <View style={styles.orderBottom}>
                      <Text style={styles.orderTotal}>{fmt(order.total_amount)}</Text>
                      {isPaid ? (
                        <View style={styles.paidBadge}>
                          <Ionicons name="checkmark-circle" size={14} color="#059669" />
                          <Text style={styles.paidText}>ชำระแล้ว</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.payBtn}
                          onPress={() => handleManualPay(order)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="cash-outline" size={14} color="#fff" />
                          <Text style={styles.payBtnText}>รับเงิน</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Advance status button */}
                    {nextStatus && (
                      <TouchableOpacity
                        style={[styles.advanceBtn, { borderColor: sColor }]}
                        onPress={() => handleAdvance(order)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.advanceBtnText, { color: sColor }]}>
                          {NEXT_LABEL[order.status]}
                        </Text>
                        <Ionicons name="arrow-forward" size={14} color={sColor} />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 12,
    paddingBottom: 100,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 12,
    color: Colors.text.secondary,
    fontSize: 15,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#059669',
  },
  liveText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  liveHint: {
    fontSize: 12,
    color: Colors.text.light,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  tableCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.primary + '12',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tableHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tableName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  orderCount: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  orderCard: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  orderCardLast: {
    borderBottomWidth: 0,
  },
  orderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderNumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderNum: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  orderTime: {
    fontSize: 12,
    color: Colors.text.light,
  },
  sourceBadge: {
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sourceBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  itemsList: {
    marginBottom: 10,
    gap: 2,
  },
  itemRow: {
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  itemPrice: {
    color: Colors.text.light,
  },
  itemMore: {
    fontSize: 12,
    color: Colors.text.light,
    fontStyle: 'italic',
  },
  orderBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  paidText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  payBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  advanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  advanceBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
