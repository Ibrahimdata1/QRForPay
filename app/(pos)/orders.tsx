import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useOrderStore } from '../../src/store/orderStore';
import { useAuthStore } from '../../src/store/authStore';
import { OrderWithItems } from '../../src/types';
import { OrderDetailModal } from '../../components/OrderDetailModal';
import { shadow, radius } from '../../constants/theme';
import { supabase } from '../../src/lib/supabase';
import { useTheme, ThemeColors } from '../../constants/ThemeContext';

const statusColors: Record<string, string> = {
  pending: '#F59E0B',
  preparing: '#8B5CF6',
  ready: '#EA580C',
  completed: '#10B981',
  cancelled: '#EF4444',
};

const statusLabels: Record<string, string> = {
  pending: 'รอดำเนินการ',
  preparing: 'กำลังทำ',
  ready: 'เสิร์ฟแล้ว',
  completed: 'เสร็จสิ้น',
  cancelled: 'ยกเลิก',
};

const methodLabels: Record<string, string> = {
  qr: 'QR PromptPay',
  cash: 'เงินสด',
  card: 'บัตรเครดิต',
};

export default function OrdersScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const shop = useAuthStore((s) => s.shop);
  const profile = useAuthStore((s) => s.profile);
  const orders = useOrderStore((s) => s.orders);
  const fetchOrders = useOrderStore((s) => s.fetchOrders);
  const cancelOrder = useOrderStore((s) => s.cancelOrder);
  const cancelOrderItem = useOrderStore((s) => s.cancelOrderItem);
  const completeOrder = useOrderStore((s) => s.completeOrder);
  const updateOrderStatus = useOrderStore((s) => s.updateOrderStatus);
  const isLoading = useOrderStore((s) => s.isLoading);
  const fetchError = useOrderStore((s) => s.fetchError);
  const newOrderIds = useOrderStore((s) => s.newOrderIds);
  const clearNewOrderIds = useOrderStore((s) => s.clearNewOrderIds);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled'>('all');
  const [payModal, setPayModal] = useState<{ order: OrderWithItems; method: 'qr' | 'cash'; cashInput: string } | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (shop?.id) {
        fetchOrders(shop.id);
      }
    }, [shop?.id])
  );

  // Auto-clear new order highlights after 8 seconds
  useEffect(() => {
    if (newOrderIds.length > 0) {
      const timer = setTimeout(clearNewOrderIds, 8000);
      return () => clearTimeout(timer);
    }
  }, [newOrderIds]);

  // Keep selectedOrder in sync with store so the modal refreshes after cancel/update
  useEffect(() => {
    if (selectedOrder) {
      const updated = orders.find((o) => o.id === selectedOrder.id);
      if (updated && updated !== selectedOrder) {
        setSelectedOrder(updated);
      } else if (!updated) {
        setSelectedOrder(null);
      }
    }
  }, [orders]);

  // Realtime: auto-refresh when orders are inserted or updated (e.g. customer places order)
  useEffect(() => {
    if (!shop?.id) return;
    const channel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `shop_id=eq.${shop.id}` },
        () => { fetchOrders(shop.id); }
      )
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [shop?.id]);

  const handleCancelOrder = (order: OrderWithItems) => {
    Alert.alert(
      'ยกเลิกออเดอร์ #' + order.order_number,
      'ต้องการยกเลิกออเดอร์นี้? ออเดอร์จะยังอยู่ในระบบแต่แสดงเป็นยกเลิก',
      [
        { text: 'ไม่ยกเลิก', style: 'cancel' },
        {
          text: 'ยืนยันยกเลิก',
          style: 'destructive',
          onPress: () => {
            if (!profile?.id) return;
            cancelOrder(order.id, profile.id)
              .then(() => {
                setSelectedOrder(null);
                if (shop?.id) fetchOrders(shop.id);
              })
              .catch((err: any) => {
                Alert.alert('เกิดข้อผิดพลาด', err.message || 'ยกเลิกออเดอร์ไม่สำเร็จ');
              });
          },
        },
      ]
    );
  };

  const handleKitchenAction = (order: OrderWithItems, nextStatus: string) => {
    updateOrderStatus(order.id, nextStatus)
      .then(() => { if (shop?.id) fetchOrders(shop.id); })
      .catch((err: any) => {
        Alert.alert('เกิดข้อผิดพลาด', err.message || 'เปลี่ยนสถานะไม่สำเร็จ');
      });
  };

  const handleManualConfirm = (order: OrderWithItems) => {
    setSelectedOrder(null); // close order detail modal first
    setPayModal({ order, method: 'qr', cashInput: '' });
  };

  const handlePayConfirm = async () => {
    if (!payModal || !profile?.id) return;
    const { order, method, cashInput } = payModal;
    const total = order.total_amount ?? 0;

    if (method === 'cash') {
      const received = parseFloat(cashInput) || 0;
      if (received < total) {
        Alert.alert('เงินไม่พอ', `ยอดที่ต้องชำระ ฿${total.toFixed(0)}`);
        return;
      }
      const change = received - total;
      const staffName = profile.full_name ?? profile.email ?? 'พนักงาน';
      Alert.alert(
        'ยืนยันรับเงินสด',
        `ออเดอร์ #${order.order_number}\nยอด ฿${total.toFixed(0)}\nรับมา ฿${received.toFixed(0)}\nทอน ฿${change.toFixed(0)}\n\nรับเงินโดย: ${staffName}`,
        [
          { text: 'ยกเลิก', style: 'cancel' },
          {
            text: 'ยืนยัน',
            onPress: async () => {
              try {
                await completeOrder(order.id, { method: 'cash', amount: total, cash_received: received, cash_change: change }, 'manual', profile.id);
                setPayModal(null);
                if (shop?.id) fetchOrders(shop.id);
              } catch (err: any) {
                Alert.alert('เกิดข้อผิดพลาด', err.message || 'ยืนยันชำระเงินไม่สำเร็จ');
              }
            },
          },
        ]
      );
    } else {
      try {
        await completeOrder(order.id, { method: 'qr', amount: total }, 'manual', profile.id);
        setPayModal(null);
        if (shop?.id) fetchOrders(shop.id);
      } catch (err: any) {
        Alert.alert('เกิดข้อผิดพลาด', err.message || 'ยืนยันชำระเงินไม่สำเร็จ');
      }
    }
  };

  const handleServed = (order: OrderWithItems) => {
    Alert.alert(
      'เสิร์ฟแล้ว',
      `ยืนยันว่าเสิร์ฟออเดอร์ #${order.order_number} แล้ว?`,
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ยืนยัน',
          onPress: () => {
            updateOrderStatus(order.id, 'completed')
              .then(() => {
                setSelectedOrder(null);
                if (shop?.id) fetchOrders(shop.id);
              })
              .catch((err: any) => {
                Alert.alert('เกิดข้อผิดพลาด', err.message || 'เปลี่ยนสถานะไม่สำเร็จ');
              });
          },
        },
      ]
    );
  };

  const handleAddItemsToOrder = (order: OrderWithItems) => {
    // Navigate to POS with resumeOrderId so the screen loads existing items
    router.push({
      pathname: '/(pos)',
      params: { resumeOrderId: order.id },
    });
  };

  const handlePayPendingOrder = (order: OrderWithItems) => {
    // Resume order for payment: navigate to POS with resumeOrderId
    // Cart will be loaded; user then goes to cart to pay
    router.push({
      pathname: '/(pos)',
      params: { resumeOrderId: order.id },
    });
  };

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const date = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', calendar: 'gregory' });
    const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    return `${date}  ${time}`;
  };

  // Active (non-completed/cancelled) orders sorted oldest-first
  const activeOrders = orders
    .filter((o) => o.status === 'pending' || o.status === 'preparing' || o.status === 'ready')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // Keep pendingOrders for the horizontal scroll section (legacy naming used below)
  const pendingOrders = activeOrders;

  const getKitchenAction = (order: OrderWithItems): { nextStatus: string; label: string; color: string } | null => {
    switch (order.status) {
      case 'pending':
        return { nextStatus: 'preparing', label: 'รับออเดอร์', color: '#8B5CF6' };
      case 'preparing':
        return { nextStatus: 'ready', label: 'พร้อมเสิร์ฟ', color: '#059669' };
      default:
        return null;
    }
  };

  const renderPendingCard = (order: OrderWithItems) => {
    const action = getKitchenAction(order);
    const isCustomer = (order as any).order_source === 'customer';
    const isNew = newOrderIds.includes(order.id);
    const statusColor = statusColors[order.status] ?? '#9CA3AF';
    return (
      <TouchableOpacity
        key={order.id}
        style={[styles.pendingCard, isCustomer && styles.pendingCardCustomer, isNew && styles.newOrderCard]}
        activeOpacity={0.7}
        onPress={() => setSelectedOrder(order)}
      >
        <View style={styles.pendingCardHeader}>
          <View style={styles.pendingCardLeft}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.pendingOrderNum}>#{order.order_number}</Text>
              {isNew ? (
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>ใหม่!</Text>
                </View>
              ) : null}
              {isCustomer ? (
                <View style={styles.customerBadge}>
                  <Text style={styles.customerBadgeText}>ลูกค้าสั่ง</Text>
                </View>
              ) : null}
            </View>
            {order.table_number ? (
              <View style={styles.tableBadge}>
                <Ionicons name="grid-outline" size={12} color="#0F766E" />
                <Text style={styles.tableBadgeText}>โต๊ะ {order.table_number}</Text>
              </View>
            ) : null}
            <View style={[styles.miniStatusBadge, { backgroundColor: statusColor + '22' }]}>
              <Text style={[styles.miniStatusText, { color: statusColor }]}>
                {statusLabels[order.status] ?? order.status}
              </Text>
            </View>
          </View>
          <Text style={styles.pendingTime}>{formatDateTime(order.created_at)}</Text>
        </View>
        <View style={styles.pendingCardFooter}>
          <Text style={styles.pendingTotal}>฿{(order.total_amount ?? 0).toFixed(0)}</Text>
          <Text style={styles.pendingItemCount}>{order.items?.length ?? 0} รายการ</Text>
          {action ? (
            <TouchableOpacity
              style={[styles.kitchenActionButton, { backgroundColor: action.color }]}
              onPress={() => handleKitchenAction(order, action.nextStatus)}
              activeOpacity={0.8}
            >
              <Text style={styles.kitchenActionText}>{action.label}</Text>
            </TouchableOpacity>
          ) : order.status === 'pending' ? (
            <TouchableOpacity
              style={styles.addItemsButton}
              onPress={() => handleAddItemsToOrder(order)}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
              <Text style={styles.addItemsButtonText}>+ เพิ่มสินค้า</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderOrder = useCallback(({ item }: { item: OrderWithItems }) => {
    const accentColor = statusColors[item.status] || '#9CA3AF';
    const action = getKitchenAction(item);
    const isCustomer = (item as any).order_source === 'customer';
    const isNew = newOrderIds.includes(item.id);
    return (
      <TouchableOpacity style={[styles.orderCard, isNew && styles.newOrderCard]} activeOpacity={0.7} onPress={() => setSelectedOrder(item)}>
        {/* Left accent bar */}
        <View style={[styles.accentBar, { backgroundColor: isNew ? '#DC2626' : accentColor }]} />

        <View style={styles.cardBody}>
          <View style={styles.orderHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8, flexWrap: 'wrap' }}>
              <Text style={styles.orderNumber}>#{item.order_number}</Text>
              {isNew ? (
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>ใหม่!</Text>
                </View>
              ) : null}
              {item.table_number ? (
                <View style={styles.tableTagSmall}>
                  <Text style={styles.tableTagText}>โต๊ะ {item.table_number}</Text>
                </View>
              ) : null}
              {isCustomer ? (
                <View style={styles.customerBadge}>
                  <Text style={styles.customerBadgeText}>ลูกค้าสั่ง</Text>
                </View>
              ) : null}
            </View>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: accentColor + '1A' },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: accentColor },
                ]}
              >
                {statusLabels[item.status] || item.status}
              </Text>
            </View>
          </View>

          <View style={styles.orderMeta}>
            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={14} color={colors.text.light} />
              <Text style={styles.detailText}>{formatDateTime(item.created_at)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="cube-outline" size={14} color={colors.text.light} />
              <Text style={styles.detailText}>{item.items?.length ?? 0} รายการ</Text>
            </View>
            {item.payment_method ? (
              <View style={styles.detailRow}>
                <Ionicons name="card-outline" size={14} color={colors.text.light} />
                <Text style={styles.detailText}>
                  {methodLabels[item.payment_method] || item.payment_method}
                </Text>
              </View>
            ) : null}
          </View>

          {item.status === 'cancelled' && item.cancelledByProfile?.full_name ? (
            <View style={styles.confirmationRow}>
              <View style={[styles.confirmBadge, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="close-circle-outline" size={11} color="#EF4444" />
                <Text style={[styles.confirmBadgeText, { color: '#EF4444' }]}>
                  ยกเลิกโดย {item.cancelledByProfile.full_name}
                </Text>
              </View>
            </View>
          ) : item.payment?.confirmation_type ? (
            <View style={styles.confirmationRow}>
              {item.payment.confirmation_type === 'manual' ? (
                <View style={[styles.confirmBadge, styles.confirmBadgeManual]}>
                  <Ionicons name="hand-left-outline" size={11} color="#D97706" />
                  <Text style={[styles.confirmBadgeText, { color: '#D97706' }]}>ยืนยันเอง</Text>
                  {item.confirmedByProfile?.full_name ? (
                    <Text style={[styles.confirmBadgeText, { color: '#D97706' }]}>
                      {' '}· {item.confirmedByProfile.full_name}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <View style={[styles.confirmBadge, styles.confirmBadgeAuto]}>
                  <Ionicons name="flash-outline" size={11} color="#0F766E" />
                  <Text style={[styles.confirmBadgeText, { color: '#0F766E' }]}>อัตโนมัติ</Text>
                </View>
              )}
            </View>
          ) : null}

          {/* Kitchen action button for active orders */}
          {action ? (
            <TouchableOpacity
              style={[styles.kitchenActionButton, { backgroundColor: action.color, marginBottom: 10 }]}
              onPress={() => handleKitchenAction(item, action.nextStatus)}
              activeOpacity={0.8}
            >
              <Text style={styles.kitchenActionText}>{action.label}</Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.orderFooter}>
            <Text style={styles.totalLabel}>ยอดรวม</Text>
            <Text style={styles.totalAmount}>฿{(item.total_amount ?? 0).toFixed(2)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [newOrderIds]);

  const filteredOrders = orders.filter(order => {
    const matchSearch = searchText === '' ||
      String(order.order_number).includes(searchText);
    const matchStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (isLoading && orders.length === 0) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Fetch error banner */}
      {fetchError ? (
        <View style={styles.errorBanner}>
          <Ionicons name="wifi-outline" size={16} color="#B45309" />
          <Text style={styles.errorBannerText}>{fetchError}</Text>
        </View>
      ) : null}
      <FlatList
        style={{ flex: 1 }}
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrder}
        contentContainerStyle={styles.listContent}
        onRefresh={() => shop?.id && fetchOrders(shop.id)}
        refreshing={isLoading}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={5}
        ListHeaderComponent={
          <View>
            {/* Active orders section (pending + kitchen workflow) — hide when filtering by completed/cancelled */}
            {pendingOrders.length > 0 && (statusFilter === 'all' || statusFilter === 'pending' || statusFilter === 'preparing' || statusFilter === 'ready') && (
              <View style={styles.pendingSection}>
                <View style={styles.pendingSectionHeader}>
                  <View style={styles.pendingSectionTitleRow}>
                    <View style={styles.openDot} />
                    <Text style={styles.pendingSectionTitle}>ออเดอร์ที่ใช้งานอยู่</Text>
                  </View>
                  <Text style={styles.pendingSectionCount}>{pendingOrders.length} รายการ</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pendingScroll}>
                  {pendingOrders.map(renderPendingCard)}
                </ScrollView>
              </View>
            )}

            {/* Search */}
            <TextInput
              style={styles.searchInput}
              placeholder="ค้นหาเลขออเดอร์..."
              placeholderTextColor={colors.text.light}
              value={searchText}
              onChangeText={setSearchText}
            />
            {/* Status filter pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}>
              {(['all', 'pending', 'preparing', 'ready', 'completed', 'cancelled'] as const).map(s => (
                <TouchableOpacity key={s}
                  style={[styles.filterPill,
                    statusFilter === s ? styles.filterPillActive : styles.filterPillInactive]}
                  onPress={() => setStatusFilter(s)}>
                  <Text style={[styles.filterPillText,
                    statusFilter === s ? styles.filterPillTextActive : styles.filterPillTextInactive]}>
                    {s === 'all' ? 'ทั้งหมด' : statusLabels[s] ?? s}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color={colors.text.light} />
            <Text style={styles.emptyText}>
              {searchText !== '' || statusFilter !== 'all'
                ? 'ไม่พบออเดอร์ที่ตรงกับการค้นหา'
                : 'ยังไม่มีรายการ'}
            </Text>
          </View>
        }
      />
      <OrderDetailModal
        visible={selectedOrder !== null}
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onCancel={handleCancelOrder}
        onPayPending={handlePayPendingOrder}
        onManualConfirm={handleManualConfirm}
        onServed={handleServed}
        profileId={profile?.id}
        onCancelItem={(orderId, itemId, cancelledBy) => {
          cancelOrderItem(orderId, itemId, cancelledBy)
            .then(() => {
              if (shop?.id) fetchOrders(shop.id);
            })
            .catch((err: any) => {
              Alert.alert('เกิดข้อผิดพลาด', err.message || 'ยกเลิกรายการไม่สำเร็จ');
            });
        }}
      />

      {/* Payment method selection modal */}
      <Modal visible={!!payModal} transparent animationType="fade" onRequestClose={() => setPayModal(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <Pressable style={styles.payOverlay} onPress={() => setPayModal(null)}>
            <Pressable style={styles.paySheet} onPress={(e) => e.stopPropagation()}>
              {payModal && (
                <>
                  <Text style={styles.paySheetTitle}>ยืนยันรับชำระเงิน</Text>
                  <Text style={styles.paySheetOrder}>ออเดอร์ #{payModal.order.order_number}</Text>
                  <Text style={styles.paySheetTotal}>฿{(payModal.order.total_amount ?? 0).toFixed(0)}</Text>

                  {/* Method selector */}
                  <Text style={styles.paySheetLabel}>วิธีชำระเงิน</Text>
                  <View style={styles.methodRow}>
                    <TouchableOpacity
                      style={[styles.methodPill, payModal.method === 'qr' && styles.methodPillActive]}
                      onPress={() => setPayModal((p) => p ? { ...p, method: 'qr', cashInput: '' } : p)}
                    >
                      <Ionicons name="phone-portrait-outline" size={16} color={payModal.method === 'qr' ? '#fff' : colors.text.secondary} />
                      <Text style={[styles.methodPillText, payModal.method === 'qr' && styles.methodPillTextActive]}>โอน/QR</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.methodPill, payModal.method === 'cash' && styles.methodPillActive]}
                      onPress={() => setPayModal((p) => p ? { ...p, method: 'cash' } : p)}
                    >
                      <Ionicons name="cash-outline" size={16} color={payModal.method === 'cash' ? '#fff' : colors.text.secondary} />
                      <Text style={[styles.methodPillText, payModal.method === 'cash' && styles.methodPillTextActive]}>เงินสด</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Cash input */}
                  {payModal.method === 'cash' && (
                    <View style={styles.cashSection}>
                      <Text style={styles.paySheetLabel}>รับเงินมา (฿)</Text>
                      <TextInput
                        style={styles.cashInput}
                        value={payModal.cashInput}
                        onChangeText={(v) => setPayModal((p) => p ? { ...p, cashInput: v } : p)}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={colors.text.light}
                        autoFocus
                      />
                      {(() => {
                        const received = parseFloat(payModal.cashInput) || 0;
                        const total = payModal.order.total_amount ?? 0;
                        const change = received - total;
                        if (received > 0 && change >= 0) return <Text style={styles.changeText}>ทอน ฿{change.toFixed(0)}</Text>;
                        if (received > 0 && change < 0) return <Text style={styles.shortText}>ขาด ฿{(-change).toFixed(0)}</Text>;
                        return null;
                      })()}
                    </View>
                  )}

                  <Text style={styles.staffText}>
                    รับเงินโดย: {profile?.full_name ?? profile?.email ?? 'พนักงาน'}
                  </Text>

                  <View style={styles.payBtns}>
                    <TouchableOpacity style={styles.payCancelBtn} onPress={() => setPayModal(null)}>
                      <Text style={styles.payCancelText}>ยกเลิก</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.payConfirmBtn} onPress={handlePayConfirm}>
                      <Text style={styles.payConfirmText}>ยืนยันรับเงิน</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  // Pending open tables section
  pendingSection: {
    marginTop: 12,
    marginBottom: 4,
  },
  pendingSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  pendingSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  openDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F59E0B',
  },
  pendingSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  pendingSectionCount: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  pendingScroll: {
    gap: 10,
    paddingBottom: 4,
  },
  pendingCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    width: 200,
    ...shadow.md,
  },
  pendingCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  pendingCardLeft: {
    flex: 1,
    gap: 4,
  },
  pendingOrderNum: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  tableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  tableBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F766E',
  },
  pendingTime: {
    fontSize: 11,
    color: colors.text.light,
    textAlign: 'right',
    flexShrink: 0,
    maxWidth: 80,
  },
  pendingCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  pendingTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    flex: 1,
  },
  pendingItemCount: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  addItemsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  addItemsButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  kitchenActionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  kitchenActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  customerBadge: {
    backgroundColor: '#F0FDF4',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  customerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },
  pendingCardCustomer: {
    borderLeftWidth: 3,
    borderLeftColor: colors.success,
  },
  miniStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  miniStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  searchInput: {
    margin: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: radius.full,
    backgroundColor: colors.borderLight,
    fontSize: 14,
    color: colors.text.primary,
  },
  filterRow: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
    alignItems: 'center',
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterPillInactive: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  filterPillTextInactive: {
    color: colors.text.secondary,
  },
  orderCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginBottom: 10,
    ...shadow.md,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  accentBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  cardBody: {
    flex: 1,
    padding: 16,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  tableTagSmall: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  tableTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0F766E',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    flexShrink: 0,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  orderMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  confirmationRow: {
    marginBottom: 10,
  },
  confirmBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  confirmBadgeManual: {
    backgroundColor: '#FEF3C7',
  },
  confirmBadgeAuto: {
    backgroundColor: colors.primaryLight,
  },
  confirmBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  totalLabel: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  totalAmount: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.primary,
    fontVariant: ['tabular-nums'] as any,
    letterSpacing: -0.3,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 15,
    color: colors.text.light,
    marginTop: 12,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#FCD34D',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  errorBannerText: {
    fontSize: 13,
    color: '#B45309',
    flex: 1,
  },
  // Payment modal
  payOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paySheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 24,
    width: '86%',
    maxWidth: 400,
    ...shadow.lg,
  },
  paySheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  paySheetOrder: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  paySheetTotal: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 16,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'] as any,
  },
  paySheetLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 8,
  },
  methodRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  methodPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  methodPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  methodPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  methodPillTextActive: {
    color: '#FFFFFF',
  },
  cashSection: {
    marginBottom: 12,
  },
  cashInput: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text.primary,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    paddingBottom: 4,
    marginBottom: 8,
  },
  changeText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.success,
  },
  shortText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.danger,
  },
  staffText: {
    fontSize: 13,
    color: colors.text.secondary,
    fontStyle: 'italic',
    marginBottom: 20,
  },
  payBtns: {
    flexDirection: 'row',
    gap: 10,
  },
  payCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  payCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  payConfirmBtn: {
    flex: 2,
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  payConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  newOrderCard: {
    borderWidth: 2,
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  newBadge: {
    backgroundColor: '#DC2626',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  newBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
