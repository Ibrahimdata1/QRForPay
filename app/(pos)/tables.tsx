// Visual Table Management — status derived from active orders
// Colors: 🟢 ว่าง (green) | 🟠 รอทำ (orange/pending) | 🟣 กำลังทำ (purple/preparing) | 🔵 พร้อมเสิร์ฟ (blue/ready)

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  Share,
  Platform,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/store/authStore';
import { useOrderStore } from '../../src/store/orderStore';
import { shadow, radius } from '../../constants/theme';
import { OrderWithItems } from '../../src/types';
import { useTheme, ThemeColors } from '../../constants/ThemeContext';

// ─── constants ───────────────────────────────────────────────────────────────

const TABLE_STATUS = {
  available: { color: '#059669', bg: '#D1FAE5', label: 'ว่าง', icon: 'checkmark-circle' as const },
  pending: { color: '#F59E0B', bg: '#FEF3C7', label: 'รอทำ', icon: 'time' as const },
  preparing: { color: '#8B5CF6', bg: '#EDE9FE', label: 'กำลังทำ', icon: 'flame' as const },
  ready: { color: '#EA580C', bg: '#FFEDD5', label: 'เสิร์ฟแล้ว', icon: 'restaurant' as const },
} as const;

type TableStatus = keyof typeof TABLE_STATUS;

const STATUS_PRIORITY: Record<string, number> = {
  ready: 3,
  preparing: 2,
  pending: 1,
};

const APP_BASE_URL =
  process.env.EXPO_PUBLIC_APP_BASE_URL ?? 'https://qrforpay.vercel.app';

function buildCustomerUrl(shopId: string, table: string): string {
  return `${APP_BASE_URL}/customer?shop=${encodeURIComponent(shopId)}&table=${encodeURIComponent(table)}`;
}

function fmt(n: number | null | undefined): string {
  return '฿' + (n ?? 0).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'เมื่อกี้';
  if (diff < 60) return `${diff} นาที`;
  return `${Math.floor(diff / 60)} ชม.`;
}

// Derive the "worst" status for a table from its active orders
function deriveTableStatus(orders: OrderWithItems[]): TableStatus {
  if (orders.length === 0) return 'available';
  let highest = 0;
  let result: TableStatus = 'pending';
  for (const o of orders) {
    const p = STATUS_PRIORITY[o.status] ?? 0;
    if (p > highest) {
      highest = p;
      result = o.status as TableStatus;
    }
  }
  return result;
}

// ─── component ───────────────────────────────────────────────────────────────

export default function TablesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const shop = useAuthStore((s) => s.shop);
  const profile = useAuthStore((s) => s.profile);
  const completeOrder = useOrderStore((s) => s.completeOrder);

  const tableCount = shop?.table_count ?? 10;
  const shopId = shop?.id ?? '';

  const [activeOrders, setActiveOrders] = useState<OrderWithItems[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [movingFromTable, setMovingFromTable] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [cashModal, setCashModal] = useState<{ order: OrderWithItems; cashInput: string } | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── fetch active orders ────────────────────────────────────────────────────
  const fetchActive = useCallback(async () => {
    if (!shopId) return;
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(
          '*, items:order_items(id, quantity, unit_price, subtotal, product:products(name)), payment:payments(*)'
        )
        .eq('shop_id', shopId)
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
  }, [shopId]);

  // ── realtime subscription ──────────────────────────────────────────────────
  useEffect(() => {
    if (!shopId) return;
    channelRef.current = supabase
      .channel(`tables:${shopId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `shop_id=eq.${shopId}` },
        () => { fetchActive(); }
      )
      .subscribe();
    return () => { channelRef.current?.unsubscribe(); };
  }, [shopId, fetchActive]);

  // ── focus refresh ──────────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchActive();
    }, [fetchActive])
  );

  // ── group orders by table_number ───────────────────────────────────────────
  const ordersByTable = activeOrders.reduce<Record<string, OrderWithItems[]>>((acc, o) => {
    const key = o.table_number ?? '__none__';
    if (!acc[key]) acc[key] = [];
    acc[key].push(o);
    return acc;
  }, {});

  // ── build numbered tables (1..tableCount) ──────────────────────────────────
  const numberedTables = Array.from({ length: tableCount }, (_, i) => {
    const num = String(i + 1);
    const orders = ordersByTable[num] ?? [];
    return { key: num, label: num, orders, status: deriveTableStatus(orders) };
  });

  // ── legend counts ──────────────────────────────────────────────────────────
  const allTables = [...numberedTables];
  const statusCounts = {
    available: allTables.filter((t) => t.status === 'available').length,
    pending: allTables.filter((t) => t.status === 'pending').length,
    preparing: allTables.filter((t) => t.status === 'preparing').length,
    ready: allTables.filter((t) => t.status === 'ready').length,
  };

  // ── selected table detail ──────────────────────────────────────────────────
  const selectedTableData = selectedTable
    ? allTables.find((t) => t.key === selectedTable)
    : null;

  const customerUrl = selectedTable ? buildCustomerUrl(shopId, selectedTable) : '';

  const handleShare = () => {
    if (!selectedTable) return;
    Share.share({
      message: `สั่งอาหารโต๊ะ ${selectedTable} — ${shop?.name ?? ''}\n${customerUrl}`,
      url: customerUrl,
    }).catch(() => {});
  };

  const handleManualPay = (order: OrderWithItems) => {
    const staffName = profile?.full_name ?? profile?.email ?? 'พนักงาน';
    Alert.alert(
      'ยืนยันรับโอน/QR',
      `ออเดอร์ #${order.order_number}\nยอด ${fmt(order.total_amount)}\n\nยืนยันโดย: ${staffName}`,
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ยืนยันรับเงินแล้ว',
          onPress: async () => {
            try {
              await completeOrder(
                order.id,
                { method: 'qr', amount: order.total_amount ?? 0 },
                'manual',
                profile?.id
              );
              fetchActive();
              setSelectedTable(null);
            } catch (err: any) {
              Alert.alert('เกิดข้อผิดพลาด', err?.message);
            }
          },
        },
      ]
    );
  };

  const handleCashPay = (order: OrderWithItems) => {
    setSelectedTable(null); // close table detail modal first (two modals conflict)
    setCashModal({ order, cashInput: '' });
  };

  const handleCashConfirm = async () => {
    if (!cashModal) return;
    const { order, cashInput } = cashModal;
    const total = order.total_amount ?? 0;
    const received = parseFloat(cashInput) || 0;
    if (received < total) {
      Alert.alert('เงินไม่พอ', `ยอดที่ต้องชำระ ${fmt(total)}`);
      return;
    }
    const change = received - total;
    const staffName = profile?.full_name ?? profile?.email ?? 'พนักงาน';
    Alert.alert(
      'ยืนยันรับเงินสด',
      `ออเดอร์ #${order.order_number}\nยอด ${fmt(total)}\nรับมา ${fmt(received)}\nทอน ${fmt(change)}\n\nรับเงินโดย: ${staffName}`,
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ยืนยัน',
          onPress: async () => {
            try {
              await completeOrder(
                order.id,
                { method: 'cash', amount: total, cash_received: received, cash_change: change },
                'manual',
                profile?.id
              );
              setCashModal(null);
              fetchActive();
              setSelectedTable(null);
            } catch (err: any) {
              Alert.alert('เกิดข้อผิดพลาด', err?.message);
            }
          },
        },
      ]
    );
  };

  // ── move table ────────────────────────────────────────────────────────────
  const handleStartMove = (tableKey: string) => {
    const tableData = allTables.find((t) => t.key === tableKey);
    if (!tableData || tableData.orders.length === 0) return;
    setMovingFromTable(tableKey);
    setSelectedTable(null); // close modal if open
  };

  const handleCancelMove = () => {
    setMovingFromTable(null);
  };

  const handleMoveTarget = async (targetKey: string) => {
    if (!movingFromTable || !shopId) return;
    if (targetKey === movingFromTable) {
      // Tap source again → cancel move
      setMovingFromTable(null);
      return;
    }

    const targetData = allTables.find((t) => t.key === targetKey);
    if (targetData && targetData.orders.length > 0) {
      Alert.alert('โต๊ะไม่ว่าง', `โต๊ะ ${targetData.label} มีออเดอร์อยู่แล้ว ไม่สามารถย้ายได้`);
      return;
    }

    // Confirm move
    const sourceLabel = allTables.find((t) => t.key === movingFromTable)?.label ?? movingFromTable;
    const targetLabel = targetData?.label ?? targetKey;

    Alert.alert(
      'ย้ายโต๊ะ',
      `ย้ายออเดอร์จากโต๊ะ ${sourceLabel} ไปโต๊ะ ${targetLabel}?`,
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ย้ายเลย',
          onPress: async () => {
            setIsMoving(true);
            try {
              const { error } = await supabase
                .from('orders')
                .update({ table_number: targetKey })
                .eq('shop_id', shopId)
                .eq('table_number', movingFromTable)
                .in('status', ['pending', 'preparing', 'ready']);

              if (error) throw error;
              setMovingFromTable(null);
              fetchActive();
            } catch (err: any) {
              Alert.alert('เกิดข้อผิดพลาด', err?.message ?? 'ย้ายโต๊ะไม่ได้');
            } finally {
              setIsMoving(false);
            }
          },
        },
      ]
    );
  };

  const handleTablePress = (tableKey: string) => {
    if (movingFromTable) {
      handleMoveTarget(tableKey);
    } else {
      setSelectedTable(tableKey);
    }
  };

  const handleTableLongPress = (tableKey: string) => {
    const tableData = allTables.find((t) => t.key === tableKey);
    if (tableData && tableData.orders.length > 0) {
      handleStartMove(tableKey);
    }
  };

  // ── render ─────────────────────────────────────────────────────────────────
  if (isLoading && activeOrders.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>กำลังโหลด...</Text>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchActive(); }}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Legend */}
        <View style={styles.legend}>
          {(Object.keys(TABLE_STATUS) as TableStatus[]).map((key) => {
            const s = TABLE_STATUS[key];
            return (
              <View key={key} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                <Text style={styles.legendLabel}>{s.label}</Text>
                <Text style={styles.legendCount}>{statusCounts[key]}</Text>
              </View>
            );
          })}
        </View>

        {/* Move mode banner */}
        {movingFromTable && (
          <View style={styles.moveBanner}>
            <View style={styles.moveBannerContent}>
              <Ionicons name="swap-horizontal" size={18} color="#FFFFFF" />
              <Text style={styles.moveBannerText}>
                {isMoving
                  ? 'กำลังย้าย...'
                  : `เลือกโต๊ะว่างเพื่อย้ายออเดอร์จากโต๊ะ ${allTables.find((t) => t.key === movingFromTable)?.label ?? movingFromTable}`}
              </Text>
            </View>
            <TouchableOpacity onPress={handleCancelMove} style={styles.moveCancelBtn}>
              <Text style={styles.moveCancelText}>ยกเลิก</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Table Grid */}
        <View style={styles.grid}>
          {numberedTables.map((t) => {
            const s = TABLE_STATUS[t.status];
            const isSource = movingFromTable === t.key;
            const isTarget = !!movingFromTable && t.status === 'available' && !isSource;
            const isBlocked = !!movingFromTable && t.status !== 'available' && !isSource;
            return (
              <TouchableOpacity
                key={t.key}
                style={[
                  styles.tableCell,
                  { backgroundColor: s.bg, borderColor: s.color },
                  isSource && styles.tableCellMoveSource,
                  isTarget && styles.tableCellMoveTarget,
                  isBlocked && styles.tableCellMoveBlocked,
                ]}
                onPress={() => handleTablePress(t.key)}
                onLongPress={() => handleTableLongPress(t.key)}
                delayLongPress={400}
                activeOpacity={0.7}
                disabled={isMoving}
              >
                {isSource && (
                  <Ionicons name="exit-outline" size={14} color="#DC2626" style={{ position: 'absolute', top: 4, right: 4 }} />
                )}
                {isTarget && (
                  <Ionicons name="enter-outline" size={14} color="#059669" style={{ position: 'absolute', top: 4, right: 4 }} />
                )}
                <Text style={[styles.tableCellNum, { color: isSource ? '#DC2626' : s.color }]}>{t.label}</Text>
                <Ionicons name={s.icon} size={16} color={isSource ? '#DC2626' : s.color} />
                <Text style={[styles.tableCellStatus, { color: isSource ? '#DC2626' : s.color }]}>
                  {isSource ? 'ย้ายจาก' : isTarget ? 'วางที่นี่' : s.label}
                </Text>
                {t.orders.length > 0 && !isSource && (
                  <Text style={[styles.tableCellOrders, { color: s.color }]}>
                    {t.orders.length} ออเดอร์
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

      </ScrollView>

      {/* Cash Payment Modal */}
      <Modal visible={!!cashModal} transparent animationType="fade" onRequestClose={() => setCashModal(null)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <Pressable style={styles.cashOverlay} onPress={() => setCashModal(null)}>
            <Pressable style={styles.cashSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.cashSheetTitle}>รับเงินสด</Text>
            {cashModal && (
              <>
                <Text style={styles.cashSheetOrder}>ออเดอร์ #{cashModal.order.order_number}</Text>
                <Text style={styles.cashSheetTotal}>ยอด {fmt(cashModal.order.total_amount)}</Text>
                <Text style={styles.cashSheetLabel}>รับเงินมา (฿)</Text>
                <TextInput
                  style={styles.cashSheetInput}
                  value={cashModal.cashInput}
                  onChangeText={(v) => setCashModal((prev) => prev ? { ...prev, cashInput: v } : prev)}
                  keyboardType="numeric"
                  placeholder="0"
                  autoFocus
                />
                {(() => {
                  const received = parseFloat(cashModal.cashInput) || 0;
                  const total = cashModal.order.total_amount ?? 0;
                  const change = received - total;
                  if (received > 0 && change >= 0) {
                    return <Text style={styles.cashSheetChange}>ทอน {fmt(change)}</Text>;
                  }
                  if (received > 0 && change < 0) {
                    return <Text style={styles.cashSheetShort}>ขาด {fmt(-change)}</Text>;
                  }
                  return null;
                })()}
                <Text style={styles.cashSheetStaff}>
                  รับเงินโดย: {profile?.full_name ?? profile?.email ?? 'พนักงาน'}
                </Text>
                <View style={styles.cashSheetBtns}>
                  <TouchableOpacity style={styles.cashSheetCancel} onPress={() => setCashModal(null)}>
                    <Text style={styles.cashSheetCancelText}>ยกเลิก</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cashSheetConfirm} onPress={handleCashConfirm}>
                    <Text style={styles.cashSheetConfirmText}>ยืนยัน</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Table Detail Modal */}
      <Modal
        visible={!!selectedTable}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedTable(null)}
      >
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              โต๊ะ {selectedTableData?.label ?? selectedTable}
            </Text>
            <TouchableOpacity onPress={() => setSelectedTable(null)} style={styles.modalClose}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
            {/* Status badge */}
            {selectedTableData && (
              <View
                style={[
                  styles.modalStatusBadge,
                  { backgroundColor: TABLE_STATUS[selectedTableData.status].bg },
                ]}
              >
                <Ionicons
                  name={TABLE_STATUS[selectedTableData.status].icon}
                  size={20}
                  color={TABLE_STATUS[selectedTableData.status].color}
                />
                <Text
                  style={[
                    styles.modalStatusText,
                    { color: TABLE_STATUS[selectedTableData.status].color },
                  ]}
                >
                  {TABLE_STATUS[selectedTableData.status].label}
                </Text>
              </View>
            )}

            {/* QR Code */}
            {selectedTable && shopId && (
              <View style={styles.qrCard}>
                <Text style={styles.qrCardTitle}>QR สั่งอาหาร</Text>
                <View style={styles.qrBox}>
                  <QRCode
                    value={customerUrl}
                    size={180}
                    backgroundColor="#FFFFFF"
                    color="#111827"
                  />
                </View>
                <Text style={styles.qrInstruction}>ลูกค้าสแกนเพื่อสั่งอาหาร</Text>
                <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                  <Ionicons name="share-outline" size={16} color={colors.primary} />
                  <Text style={styles.shareButtonText}>แชร์ลิงก์</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Move table button (in modal) */}
            {selectedTableData && selectedTableData.orders.length > 0 && (
              <TouchableOpacity
                style={styles.moveTableBtn}
                onPress={() => handleStartMove(selectedTable!)}
              >
                <Ionicons name="swap-horizontal" size={18} color="#FFFFFF" />
                <Text style={styles.moveTableBtnText}>ย้ายโต๊ะ</Text>
              </TouchableOpacity>
            )}

            {/* Orders for this table */}
            {selectedTableData && selectedTableData.orders.length > 0 ? (
              <View style={styles.ordersSection}>
                <Text style={styles.ordersSectionTitle}>
                  ออเดอร์ ({selectedTableData.orders.length})
                </Text>
                {selectedTableData.orders.map((order) => {
                  const sColor = TABLE_STATUS[order.status as TableStatus]?.color ?? '#999';
                  const sLabel = TABLE_STATUS[order.status as TableStatus]?.label ?? order.status;
                  const items: any[] = (order as any).items ?? [];
                  const isPaid = order.payment?.status === 'success';
                  return (
                    <View key={order.id} style={styles.orderCard}>
                      <View style={styles.orderTop}>
                        <Text style={styles.orderNum}>#{order.order_number}</Text>
                        <Text style={styles.orderTime}>{timeAgo(order.created_at)}</Text>
                        <View style={[styles.statusPill, { backgroundColor: sColor + '22', borderColor: sColor }]}>
                          <Text style={[styles.statusPillText, { color: sColor }]}>{sLabel}</Text>
                        </View>
                      </View>

                      {/* Items */}
                      {items.slice(0, 5).map((item: any) => (
                        <Text key={item.id} style={styles.itemRow}>
                          {item.product?.name ?? 'สินค้า'} ×{item.quantity}{'  '}
                          <Text style={styles.itemPrice}>{fmt(item.subtotal)}</Text>
                        </Text>
                      ))}
                      {items.length > 5 && (
                        <Text style={styles.itemMore}>+{items.length - 5} รายการ</Text>
                      )}

                      {/* Total */}
                      <Text style={styles.orderTotal}>{fmt(order.total_amount)}</Text>

                      {/* Payment buttons or paid badge */}
                      {isPaid ? (
                        <View style={styles.paidBadge}>
                          <Ionicons name="checkmark-circle" size={14} color="#059669" />
                          <Text style={styles.paidText}>ชำระแล้ว</Text>
                        </View>
                      ) : (
                        <View style={styles.payBtnRow}>
                          <TouchableOpacity style={styles.payQrBtn} onPress={() => handleManualPay(order)}>
                            <Ionicons name="phone-portrait-outline" size={14} color="#fff" />
                            <Text style={styles.payBtnText}>ยืนยันรับโอน</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.payCashBtn} onPress={() => handleCashPay(order)}>
                            <Ionicons name="cash-outline" size={14} color="#fff" />
                            <Text style={styles.payBtnText}>รับเงินสด</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ) : selectedTableData ? (
              <View style={styles.emptyOrders}>
                <Ionicons name="checkmark-circle-outline" size={40} color={colors.text.light} />
                <Text style={styles.emptyOrdersText}>ไม่มีออเดอร์</Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 12,
    paddingBottom: 100,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    color: colors.text.secondary,
    fontSize: 15,
  },

  // Legend
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 14,
    ...shadow.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  legendCount: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.light,
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 5,
    overflow: 'hidden',
  },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tableCell: {
    width: '23%',
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
    ...(Platform.OS === 'web'
      ? { minWidth: 70, maxWidth: 90, width: 'auto', flexBasis: '23%' }
      : {}),
  },
  tableCellNum: {
    fontSize: 18,
    fontWeight: '800',
  },
  tableCellStatus: {
    fontSize: 10,
    fontWeight: '600',
  },
  tableCellOrders: {
    fontSize: 9,
    fontWeight: '500',
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  modalClose: {
    padding: 4,
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    padding: 16,
    paddingBottom: 40,
  },
  modalStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  modalStatusText: {
    fontSize: 15,
    fontWeight: '700',
  },

  // QR Card (in modal)
  qrCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    ...shadow.md,
  },
  qrCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 12,
  },
  qrBox: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  qrInstruction: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 10,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },

  // Orders section
  ordersSection: {
    marginTop: 4,
  },
  ordersSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 10,
  },
  orderCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
    ...shadow.sm,
  },
  orderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  orderNum: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  orderTime: {
    fontSize: 12,
    color: colors.text.light,
    flex: 1,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  itemRow: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  itemPrice: {
    color: colors.text.light,
  },
  itemMore: {
    fontSize: 12,
    color: colors.text.light,
    fontStyle: 'italic',
  },
  orderTotal: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: 10,
    marginBottom: 10,
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  paidText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  payBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  payQrBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 10,
  },
  payCashBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.success,
    paddingVertical: 10,
    borderRadius: 10,
  },
  payBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Cash payment modal
  cashOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cashSheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 24,
    width: '86%',
    maxWidth: 400,
    ...shadow.lg,
  },
  cashSheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  cashSheetOrder: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  cashSheetTotal: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 16,
  },
  cashSheetLabel: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 6,
    fontWeight: '500',
  },
  cashSheetInput: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text.primary,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    paddingBottom: 4,
    marginBottom: 10,
  },
  cashSheetChange: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.success,
    marginBottom: 8,
  },
  cashSheetShort: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.danger,
    marginBottom: 8,
  },
  cashSheetStaff: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 18,
    fontStyle: 'italic',
  },
  cashSheetBtns: {
    flexDirection: 'row',
    gap: 10,
  },
  cashSheetCancel: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cashSheetCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  cashSheetConfirm: {
    flex: 2,
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cashSheetConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Move mode
  moveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  moveBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  moveBannerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  moveCancelBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
  },
  moveCancelText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  tableCellMoveSource: {
    borderColor: '#DC2626',
    borderWidth: 2.5,
    backgroundColor: '#FEE2E2',
  },
  tableCellMoveTarget: {
    borderColor: '#059669',
    borderWidth: 2.5,
    borderStyle: 'dashed',
    backgroundColor: '#D1FAE5',
  },
  tableCellMoveBlocked: {
    opacity: 0.4,
  },
  moveTableBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 16,
  },
  moveTableBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  // Empty orders
  emptyOrders: {
    alignItems: 'center',
    paddingVertical: 30,
    gap: 8,
  },
  emptyOrdersText: {
    fontSize: 14,
    color: colors.text.light,
  },
});
