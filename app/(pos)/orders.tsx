import { useCallback, useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useOrderStore } from '../../src/store/orderStore';
import { useAuthStore } from '../../src/store/authStore';
import { OrderWithItems } from '../../src/types';
import { OrderDetailModal } from '../../components/OrderDetailModal';
import { Colors } from '../../constants/colors';

const statusColors: Record<string, string> = {
  pending: '#F59E0B',
  confirmed: '#0891B2',
  preparing: '#8B5CF6',
  ready: '#059669',
  delivered: '#0F766E',
  completed: '#10B981',
  cancelled: '#EF4444',
};

const statusLabels: Record<string, string> = {
  pending: 'รอดำเนินการ',
  confirmed: 'ยืนยันแล้ว',
  preparing: 'กำลังทำ',
  ready: 'พร้อมเสิร์ฟ',
  delivered: 'ส่งแล้ว',
  completed: 'สำเร็จ',
  cancelled: 'ยกเลิก',
};

const methodLabels: Record<string, string> = {
  qr: 'QR PromptPay',
  cash: 'เงินสด',
  card: 'บัตรเครดิต',
};

export default function OrdersScreen() {
  const shop = useAuthStore((s) => s.shop);
  const profile = useAuthStore((s) => s.profile);
  const orders = useOrderStore((s) => s.orders);
  const fetchOrders = useOrderStore((s) => s.fetchOrders);
  const cancelOrder = useOrderStore((s) => s.cancelOrder);
  const updateOrderStatus = useOrderStore((s) => s.updateOrderStatus);
  const isLoading = useOrderStore((s) => s.isLoading);
  const fetchError = useOrderStore((s) => s.fetchError);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'completed' | 'cancelled'>('all');

  useFocusEffect(
    useCallback(() => {
      if (shop?.id) {
        fetchOrders(shop.id);
      }
    }, [shop?.id])
  );

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

  const handleKitchenAction = (order: OrderWithItems, nextStatus: string, label: string) => {
    Alert.alert(
      `${label} #${order.order_number}`,
      `ยืนยันเปลี่ยนสถานะเป็น "${statusLabels[nextStatus]}"?`,
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ยืนยัน',
          onPress: () => {
            updateOrderStatus(order.id, nextStatus)
              .then(() => {
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
    .filter((o) => !['completed', 'cancelled'].includes(o.status))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // Keep pendingOrders for the horizontal scroll section (legacy naming used below)
  const pendingOrders = activeOrders;

  const getKitchenAction = (order: OrderWithItems): { nextStatus: string; label: string; color: string } | null => {
    switch (order.status) {
      case 'pending':
        return { nextStatus: 'preparing', label: 'กำลังทำ', color: '#8B5CF6' };
      case 'confirmed':
        return { nextStatus: 'preparing', label: 'กำลังทำ', color: '#8B5CF6' };
      case 'preparing':
        return { nextStatus: 'ready', label: 'พร้อมเสิร์ฟ', color: '#059669' };
      case 'ready':
        return { nextStatus: 'delivered', label: 'ส่งแล้ว', color: '#0F766E' };
      default:
        return null;
    }
  };

  const renderPendingCard = (order: OrderWithItems) => {
    const action = getKitchenAction(order);
    const isCustomer = (order as any).order_source === 'customer';
    const statusColor = statusColors[order.status] ?? '#9CA3AF';
    return (
      <TouchableOpacity
        key={order.id}
        style={[styles.pendingCard, isCustomer && styles.pendingCardCustomer]}
        activeOpacity={0.7}
        onPress={() => setSelectedOrder(order)}
      >
        <View style={styles.pendingCardHeader}>
          <View style={styles.pendingCardLeft}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.pendingOrderNum}>#{order.order_number}</Text>
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
              onPress={() => handleKitchenAction(order, action.nextStatus, action.label)}
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
              <Ionicons name="add-circle-outline" size={16} color={Colors.primary} />
              <Text style={styles.addItemsButtonText}>+ เพิ่มสินค้า</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderOrder = ({ item }: { item: OrderWithItems }) => {
    const accentColor = statusColors[item.status] || '#9CA3AF';
    const action = getKitchenAction(item);
    const isCustomer = (item as any).order_source === 'customer';
    return (
      <TouchableOpacity style={styles.orderCard} activeOpacity={0.7} onPress={() => setSelectedOrder(item)}>
        {/* Left accent bar */}
        <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

        <View style={styles.cardBody}>
          <View style={styles.orderHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8, flexWrap: 'wrap' }}>
              <Text style={styles.orderNumber}>#{item.order_number}</Text>
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
              <Ionicons name="time-outline" size={14} color={Colors.text.light} />
              <Text style={styles.detailText}>{formatDateTime(item.created_at)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="cube-outline" size={14} color={Colors.text.light} />
              <Text style={styles.detailText}>{item.items?.length ?? 0} รายการ</Text>
            </View>
            {item.payment_method ? (
              <View style={styles.detailRow}>
                <Ionicons name="card-outline" size={14} color={Colors.text.light} />
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
              onPress={() => handleKitchenAction(item, action.nextStatus, action.label)}
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
  };

  const filteredOrders = orders.filter(order => {
    const matchSearch = searchText === '' ||
      String(order.order_number).includes(searchText);
    const matchStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (isLoading && orders.length === 0) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
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
        ListHeaderComponent={
          <View>
            {/* Active orders section (pending + kitchen workflow) */}
            {pendingOrders.length > 0 && (
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
              placeholderTextColor={Colors.text.light}
              value={searchText}
              onChangeText={setSearchText}
            />
            {/* Status filter pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}>
              {(['all', 'pending', 'confirmed', 'preparing', 'ready', 'delivered', 'completed', 'cancelled'] as const).map(s => (
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
            <Ionicons name="receipt-outline" size={64} color={Colors.text.light} />
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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
    color: Colors.text.primary,
  },
  pendingSectionCount: {
    fontSize: 13,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  pendingScroll: {
    gap: 10,
    paddingBottom: 4,
  },
  pendingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    width: 200,
    borderWidth: 1.5,
    borderColor: '#FCD34D',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
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
    color: Colors.text.primary,
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
    color: Colors.text.light,
    textAlign: 'right',
    flexShrink: 0,
    maxWidth: 80,
  },
  pendingCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
  },
  pendingTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
    flex: 1,
  },
  pendingItemCount: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  addItemsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  addItemsButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
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
    borderColor: '#86EFAC',
    borderWidth: 1.5,
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
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    fontSize: 14,
    color: Colors.text.primary,
  },
  filterRow: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
    alignItems: 'center',
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterPillInactive: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '500',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  filterPillTextInactive: {
    color: Colors.text.secondary,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
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
    color: Colors.text.primary,
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
    borderRadius: 8,
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
    color: Colors.text.secondary,
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
    backgroundColor: Colors.primaryLight,
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
    borderTopColor: Colors.border,
    paddingTop: 10,
  },
  totalLabel: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  totalAmount: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.text.light,
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
});
