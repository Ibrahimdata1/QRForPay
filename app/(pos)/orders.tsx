import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  RefreshControl,
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
  const historyOrders = useOrderStore((s) => s.historyOrders);
  const historyTotal = useOrderStore((s) => s.historyTotal);
  const historyLoading = useOrderStore((s) => s.historyLoading);
  const fetchOrderHistory = useOrderStore((s) => s.fetchOrderHistory);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled'>('all');
  const [payModal, setPayModal] = useState<{ order: OrderWithItems; method: 'qr' | 'cash'; cashInput: string } | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  // History section state
  const [historyDateRange, setHistoryDateRange] = useState<'today' | 'yesterday' | '7days' | '30days'>('today');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'completed' | 'cancelled'>('all');
  const [historyOffset, setHistoryOffset] = useState(0);
  const HISTORY_PAGE_SIZE = 15;
  const [billPayModal, setBillPayModal] = useState<{
    tableNumber: string;
    orders: OrderWithItems[];
    totalAmount: number;
    method: 'qr' | 'cash';
    cashInput: string;
  } | null>(null);

  const getDateRange = useCallback((range: 'today' | 'yesterday' | '7days' | '30days') => {
    const now = new Date();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    switch (range) {
      case 'today': return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(), end: endOfToday.toISOString() };
      case 'yesterday': { const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1); return { start: y.toISOString(), end: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString() }; }
      case '7days': { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6); return { start: d.toISOString(), end: endOfToday.toISOString() }; }
      case '30days': { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29); return { start: d.toISOString(), end: endOfToday.toISOString() }; }
    }
  }, []);

  const refreshHistory = useCallback((range?: typeof historyDateRange, status?: typeof historyStatusFilter) => {
    if (!shop?.id) return;
    const r = range ?? historyDateRange;
    const s = status ?? historyStatusFilter;
    setHistoryOffset(0);
    fetchOrderHistory(shop.id, getDateRange(r), s, HISTORY_PAGE_SIZE, 0);
  }, [shop?.id, historyDateRange, historyStatusFilter, getDateRange]);

  useFocusEffect(
    useCallback(() => {
      if (shop?.id) {
        setHistoryOffset(0);
        fetchOrders(shop.id);
        fetchOrderHistory(shop.id, getDateRange(historyDateRange), historyStatusFilter, HISTORY_PAGE_SIZE, 0);
      }
    }, [shop?.id, historyDateRange, historyStatusFilter, getDateRange])
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

  // Realtime handled by _layout.tsx (pos-layout-orders) — no duplicate channel needed here.

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

  const handleBillPayConfirm = async () => {
    if (!billPayModal || !profile?.id) return;
    const { orders: billOrders, method, cashInput, totalAmount } = billPayModal;

    if (method === 'cash') {
      const received = parseFloat(cashInput) || 0;
      if (received < totalAmount) {
        Alert.alert('เงินไม่พอ', `ยอดรวมทั้งโต๊ะ ฿${totalAmount.toFixed(0)}`);
        return;
      }
      const change = received - totalAmount;
      const staffName = profile.full_name ?? profile.email ?? 'พนักงาน';
      Alert.alert(
        'ยืนยันรับเงินสด',
        `โต๊ะ ${billPayModal.tableNumber}\nรวม ${billOrders.length} ออเดอร์\nยอด ฿${totalAmount.toFixed(0)}\nรับมา ฿${received.toFixed(0)}\nทอน ฿${change.toFixed(0)}\n\nรับเงินโดย: ${staffName}`,
        [
          { text: 'ยกเลิก', style: 'cancel' },
          {
            text: 'ยืนยัน',
            onPress: async () => {
              try {
                for (let i = 0; i < billOrders.length; i++) {
                  const order = billOrders[i];
                  const isLast = i === billOrders.length - 1;
                  await completeOrder(
                    order.id,
                    { method: 'cash', amount: order.total_amount ?? 0, ...(isLast ? { cash_received: received, cash_change: change } : {}) },
                    'manual',
                    profile.id
                  );
                }
                setBillPayModal(null);
                if (shop?.id) fetchOrders(shop.id);
              } catch (err: any) {
                if (shop?.id) fetchOrders(shop.id);
                Alert.alert('เกิดข้อผิดพลาด', err.message || 'ชำระเงินไม่สำเร็จ');
              }
            },
          },
        ]
      );
    } else {
      // QR/transfer - complete all orders
      const staffName = profile.full_name ?? profile.email ?? 'พนักงาน';
      Alert.alert(
        'ยืนยันรับโอน',
        `โต๊ะ ${billPayModal.tableNumber}\nรวม ${billOrders.length} ออเดอร์\nยอด ฿${totalAmount.toFixed(0)}\n\nรับเงินโดย: ${staffName}`,
        [
          { text: 'ยกเลิก', style: 'cancel' },
          {
            text: 'ยืนยัน',
            onPress: async () => {
              try {
                for (const order of billOrders) {
                  await completeOrder(
                    order.id,
                    { method: 'qr', amount: order.total_amount ?? 0 },
                    'manual',
                    profile.id
                  );
                }
                setBillPayModal(null);
                if (shop?.id) fetchOrders(shop.id);
              } catch (err: any) {
                Alert.alert('เกิดข้อผิดพลาด', err.message || 'ชำระเงินไม่สำเร็จ');
              }
            },
          },
        ]
      );
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

  // Pending + preparing orders for top section (sorted oldest-first, pending before preparing)
  const pendingOrders = orders
    .filter((o) => o.status === 'pending' || o.status === 'preparing')
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

  const timeAgo = (dateStr: string) => {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return 'เมื่อสักครู่';
    if (mins < 60) return `${mins} นาทีที่แล้ว`;
    const hrs = Math.floor(mins / 60);
    return `${hrs} ชม.ที่แล้ว`;
  };

  // Combined table bills for bills mode
  const tableBills = useMemo(() => {
    const activeWithTable = orders.filter(o =>
      (o.status === 'pending' || o.status === 'preparing' || o.status === 'ready')
      && o.table_number
    );
    const groups: Record<string, OrderWithItems[]> = {};
    activeWithTable.forEach(o => {
      const key = o.table_number!;
      if (!groups[key]) groups[key] = [];
      groups[key].push(o);
    });
    return Object.entries(groups)
      .map(([tableNum, tableOrders]) => ({
        tableNumber: tableNum,
        orders: tableOrders.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
        totalAmount: tableOrders.reduce((sum, o) => sum + (o.total_amount ?? 0), 0),
        allItems: (() => {
          const raw = tableOrders.flatMap(o =>
            (o.items ?? []).filter(i => (i as any).item_status === undefined || (i as any).item_status === 'active')
              .map(i => ({ ...i, _orderId: o.id, _orderNumber: o.order_number }))
          );
          // Merge items with same product_id, keep source references
          const merged: Record<string, { product: any; quantity: number; subtotal: number; id: string; sourceItems: { id: string; orderId: string; orderNumber: number; quantity: number; subtotal: number }[] }> = {};
          raw.forEach(i => {
            const pid = i.product_id;
            const sourceRef = { id: (i as any).id ?? pid, orderId: (i as any)._orderId, orderNumber: (i as any)._orderNumber, quantity: i.quantity, subtotal: i.subtotal ?? 0 };
            if (merged[pid]) {
              merged[pid].quantity += i.quantity;
              merged[pid].subtotal += (i.subtotal ?? 0);
              merged[pid].sourceItems.push(sourceRef);
            } else {
              merged[pid] = { product: (i as any).product, quantity: i.quantity, subtotal: i.subtotal ?? 0, id: (i as any).id ?? pid, sourceItems: [sourceRef] };
            }
          });
          return Object.values(merged);
        })(),
      }))
      .sort((a, b) => parseInt(a.tableNumber) - parseInt(b.tableNumber));
  }, [orders]);

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
    const isPending = order.status === 'pending';
    const cardStyle = isPending ? styles.pendingCardPink : styles.pendingCardYellow;
    return (
      <TouchableOpacity
        key={order.id}
        style={[styles.pendingCard, cardStyle, isCustomer && styles.pendingCardCustomer, isNew && styles.newOrderCard]}
        activeOpacity={0.7}
        onPress={() => setSelectedOrder(order)}
      >
        <View style={styles.pendingCardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
            <Text style={styles.pendingOrderNum}>#{order.order_number}</Text>
            {order.table_number ? (
              <Text style={styles.pendingTableText}>· โต๊ะ {order.table_number}</Text>
            ) : null}
          </View>
          <Text style={styles.pendingTime}>{timeAgo(order.created_at)}</Text>
        </View>
        {(isNew || isCustomer) ? (
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
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
        ) : null}
        <View style={styles.pendingCardFooter}>
          <View style={styles.pendingCardFooterTop}>
            <Text style={styles.pendingTotal} numberOfLines={1}>฿{(order.total_amount ?? 0).toLocaleString('th-TH')}</Text>
            <Text style={styles.pendingItemCount}>{order.items?.length ?? 0} รายการ</Text>
          </View>
          {action ? (
            <TouchableOpacity
              style={[styles.kitchenActionButton, { backgroundColor: action.color }]}
              onPress={() => handleKitchenAction(order, action.nextStatus)}
              activeOpacity={0.8}
            >
              <Text style={styles.kitchenActionText}>{action.label}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  // Guard: super_admin has no shop — show admin empty state
  if (!shop) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', gap: 12 }]}>
        <Ionicons name="shield-checkmark-outline" size={56} color={colors.primary} />
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text.primary }}>
          คุณเป็น System Admin
        </Text>
        <Text style={{ fontSize: 14, color: colors.text.secondary, textAlign: 'center', paddingHorizontal: 32 }}>
          ยังไม่มีร้านค้าที่ผูกกับบัญชีนี้
        </Text>
      </View>
    );
  }

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

      {/* ===== Tab Switcher ===== */}
      <View style={styles.tabSwitcher}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'active' && styles.tabItemActive]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabLabel, activeTab === 'active' && styles.tabLabelActive]}>
            กำลังดำเนินการ
          </Text>
          {pendingOrders.length > 0 && (
            <View style={[styles.tabBadge, activeTab !== 'active' && pendingOrders.length > 0 && styles.tabBadgeAlert]}>
              <Text style={[styles.tabBadgeText, activeTab !== 'active' && pendingOrders.length > 0 && styles.tabBadgeAlertText]}>
                {pendingOrders.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'history' && styles.tabItemActive]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabLabel, activeTab === 'history' && styles.tabLabelActive]}>
            ประวัติ
          </Text>
          {historyTotal > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{historyTotal}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ===== Tab Content: กำลังดำเนินการ ===== */}
      {activeTab === 'active' ? (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              if (!shop?.id) return;
              setRefreshing(true);
              fetchOrders(shop.id).finally(() => setRefreshing(false));
            }}
          />
        }
      >
        {/* ===== Section 1: ออเดอร์ที่ต้องจัดการ ===== */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.openDot} />
            <Text style={styles.pendingSectionTitle}>
              ออเดอร์ที่ต้องจัดการ{pendingOrders.length > 0 ? ` (${pendingOrders.length})` : ''}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setShowSearch(s => !s)} style={styles.searchIconBtn}>
            <Ionicons name={showSearch ? 'close-circle' : 'search'} size={20} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Search bar + filter pills (hidden by default) */}
        {showSearch && (
          <View>
            <TextInput
              style={styles.searchInput}
              placeholder="ค้นหาเลขออเดอร์..."
              placeholderTextColor={colors.text.light}
              value={searchText}
              onChangeText={setSearchText}
              autoFocus
            />
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
        )}

        {pendingOrders.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pendingScroll}>
            {pendingOrders.map(renderPendingCard)}
          </ScrollView>
        ) : (
          <Text style={styles.emptyInlineText}>ไม่มีออเดอร์ใหม่</Text>
        )}

        {/* ===== Section 2: บิลรวมโต๊ะ ===== */}
        <View style={[styles.sectionHeader, { marginTop: 20 }]}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="receipt-outline" size={16} color={colors.text.primary} />
            <Text style={styles.pendingSectionTitle}>
              บิลรวมโต๊ะ{tableBills.length > 0 ? ` (${tableBills.length})` : ''}
            </Text>
          </View>
        </View>

        {tableBills.length > 0 ? (
          <View style={{ marginTop: 8 }}>
            {tableBills.map((bill) => (
              <View key={bill.tableNumber} style={styles.billCard}>
                <View style={styles.billHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <Ionicons name="grid-outline" size={18} color={colors.primary} />
                    <Text style={styles.billTableNum}>โต๊ะ {bill.tableNumber}</Text>
                    <Text style={styles.billOrderCount}>{bill.orders.length} ออเดอร์</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.billCancelAllBtn}
                    onPress={() => {
                      Alert.alert(
                        `ยกเลิกทั้งโต๊ะ ${bill.tableNumber}`,
                        `ยกเลิกทุกออเดอร์ (${bill.orders.length} รายการ ฿${bill.totalAmount.toFixed(0)})?\nการกระทำนี้ไม่สามารถย้อนกลับได้`,
                        [
                          { text: 'ไม่ยกเลิก', style: 'cancel' },
                          {
                            text: 'ยืนยันยกเลิกทั้งโต๊ะ',
                            style: 'destructive',
                            onPress: async () => {
                              if (!profile?.id) return;
                              let failed = 0;
                              for (const order of bill.orders) {
                                try {
                                  await cancelOrder(order.id, profile.id);
                                } catch {
                                  failed++;
                                }
                              }
                              if (shop?.id) fetchOrders(shop.id);
                              if (failed > 0) {
                                Alert.alert('ผิดพลาด', `ยกเลิกไม่สำเร็จ ${failed} จาก ${bill.orders.length} ออเดอร์`);
                              }
                            },
                          },
                        ]
                      );
                    }}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    <Text style={styles.billCancelAllText}>ยกเลิกทั้งโต๊ะ</Text>
                  </TouchableOpacity>
                </View>

                {/* Status overview */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  {(['pending', 'preparing', 'ready'] as const).map(st => {
                    const count = bill.orders.filter(o => o.status === st).length;
                    if (count === 0) return null;
                    return (
                      <View key={st} style={[styles.miniStatusBadge, { backgroundColor: (statusColors[st] ?? '#9CA3AF') + '22' }]}>
                        <Text style={[styles.miniStatusText, { color: statusColors[st] ?? '#9CA3AF' }]}>
                          {statusLabels[st]} {count}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {/* Merged items list (no duplicates) */}
                {bill.allItems.map((item: any, idx: number) => (
                  <View key={item.id ?? idx} style={styles.billItemRow}>
                    <Text style={styles.billItemName} numberOfLines={1}>
                      {item.product?.name ?? 'สินค้า'}
                    </Text>
                    <Text style={styles.billItemQty}>x{item.quantity}</Text>
                    <Text style={styles.billItemPrice}>฿{item.subtotal.toFixed(0)}</Text>
                    <TouchableOpacity
                      style={styles.billItemCancelBtn}
                      onPress={() => {
                        const sources: any[] = item.sourceItems ?? [];
                        if (sources.length === 0) return;
                        const itemName = item.product?.name ?? 'สินค้า';
                        if (sources.length === 1) {
                          // Single source -- cancel directly
                          const src = sources[0];
                          Alert.alert(
                            `ยกเลิก "${itemName}"`,
                            `ลบ ${itemName} x${src.quantity} จากออเดอร์ #${src.orderNumber}?`,
                            [
                              { text: 'ไม่ลบ', style: 'cancel' },
                              {
                                text: 'ยืนยันลบ',
                                style: 'destructive',
                                onPress: () => {
                                  if (!profile?.id) return;
                                  cancelOrderItem(src.orderId, src.id, profile.id)
                                    .then(() => { if (shop?.id) fetchOrders(shop.id); })
                                    .catch((err: any) => Alert.alert('ผิดพลาด', err.message));
                                },
                              },
                            ]
                          );
                        } else {
                          // Multiple sources -- let user pick which order's item to cancel
                          const buttons = sources.map((src: any) => ({
                            text: `#${src.orderNumber} (x${src.quantity})`,
                            onPress: () => {
                              Alert.alert(
                                `ยืนยันลบ "${itemName}"`,
                                `ลบ ${itemName} x${src.quantity} จากออเดอร์ #${src.orderNumber}?`,
                                [
                                  { text: 'ไม่ลบ', style: 'cancel' },
                                  {
                                    text: 'ยืนยันลบ',
                                    style: 'destructive',
                                    onPress: () => {
                                      if (!profile?.id) return;
                                      cancelOrderItem(src.orderId, src.id, profile.id)
                                        .then(() => { if (shop?.id) fetchOrders(shop.id); })
                                        .catch((err: any) => Alert.alert('ผิดพลาด', err.message));
                                    },
                                  },
                                ]
                              );
                            },
                          }));
                          buttons.push({ text: 'ยกเลิก', onPress: () => {} });
                          Alert.alert(
                            `ลบ "${itemName}" จากออเดอร์ไหน?`,
                            `${itemName} มาจาก ${sources.length} ออเดอร์`,
                            buttons as any
                          );
                        }
                      }}
                    >
                      <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}

                {/* Order rows with item details */}
                {bill.orders.map((order) => {
                  const orderStatusColor = statusColors[order.status] ?? '#9CA3AF';
                  const activeItems = (order.items ?? []).filter((i: any) => (i.item_status ?? 'active') === 'active');
                  return (
                    <View key={order.id} style={styles.billOrderSection}>
                      <View style={styles.billOrderCompact}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                          <Text style={styles.billOrderNum}>#{order.order_number}</Text>
                          <View style={[styles.orderStatusPill, { backgroundColor: orderStatusColor }]}>
                            <Text style={styles.orderStatusPillText}>
                              {statusLabels[order.status] ?? order.status}
                            </Text>
                          </View>
                          <Text style={styles.billOrderPrice}>฿{(order.total_amount ?? 0).toLocaleString('th-TH')}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.billCancelBtn}
                          onPress={() => {
                            const isCooked = order.status === 'preparing' || order.status === 'ready';
                            const warning = isCooked ? '\n⚠️ อาหารกำลังทำ/ทำเสร็จแล้ว' : '';
                            Alert.alert(
                              `ยกเลิกออเดอร์ #${order.order_number}`,
                              `ยกเลิกทั้งออเดอร์ (${activeItems.length} รายการ ฿${(order.total_amount ?? 0).toFixed(0)})?${warning}`,
                              [
                                { text: 'ไม่ยกเลิก', style: 'cancel' },
                                {
                                  text: 'ยืนยันยกเลิก',
                                  style: 'destructive',
                                  onPress: () => {
                                    if (!profile?.id) return;
                                    cancelOrder(order.id, profile.id)
                                      .then(() => { if (shop?.id) fetchOrders(shop.id); })
                                      .catch((err: any) => Alert.alert('ผิดพลาด', err.message));
                                  },
                                },
                              ]
                            );
                          }}
                        >
                          <Ionicons name="trash-outline" size={15} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                      {/* Item details per order (merged by product) */}
                      {(() => {
                        const merged: Record<string, { name: string; qty: number; itemIds: string[] }> = {};
                        activeItems.forEach((item: any) => {
                          const pid = item.product_id ?? item.id;
                          const name = item.product?.name ?? 'สินค้า';
                          if (merged[pid]) {
                            merged[pid].qty += item.quantity;
                            merged[pid].itemIds.push(item.id);
                          } else {
                            merged[pid] = { name, qty: item.quantity, itemIds: [item.id] };
                          }
                        });
                        return Object.entries(merged).map(([pid, { name, qty, itemIds }]) => (
                          <View key={pid} style={styles.billOrderItemRow}>
                            <Text style={styles.billOrderItemName} numberOfLines={1}>{name}</Text>
                            <Text style={styles.billOrderItemQty}>x{qty}</Text>
                            <TouchableOpacity
                              style={{ padding: 4, marginLeft: 4 }}
                              onPress={() => {
                                Alert.alert(
                                  `ยกเลิก "${name}"`,
                                  `ลบ ${name} x${qty} จากออเดอร์ #${order.order_number}?`,
                                  [
                                    { text: 'ไม่ลบ', style: 'cancel' },
                                    {
                                      text: 'ยืนยันลบ',
                                      style: 'destructive',
                                      onPress: async () => {
                                        if (!profile?.id) return;
                                        try {
                                          for (const iid of itemIds) {
                                            await cancelOrderItem(order.id, iid, profile.id);
                                          }
                                          if (shop?.id) fetchOrders(shop.id);
                                        } catch (err: any) {
                                          if (shop?.id) fetchOrders(shop.id);
                                          Alert.alert('ผิดพลาด', err.message);
                                        }
                                      },
                                    },
                                  ]
                                );
                              }}
                            >
                              <Ionicons name="close-circle" size={16} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        ));
                      })()}
                    </View>
                  );
                })}

                {/* Total */}
                <View style={styles.billTotalRow}>
                  <Text style={styles.billTotalLabel}>ยอดรวม</Text>
                  <Text style={styles.billTotalAmount}>฿{bill.totalAmount.toFixed(0)}</Text>
                </View>

                {/* Payment buttons */}
                <View style={styles.billPayBtns}>
                  <TouchableOpacity
                    style={[styles.billPayBtn, { backgroundColor: colors.primary }]}
                    onPress={() => setBillPayModal({
                      tableNumber: bill.tableNumber,
                      orders: bill.orders,
                      totalAmount: bill.totalAmount,
                      method: 'qr',
                      cashInput: '',
                    })}
                  >
                    <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                    <Text style={styles.billPayBtnText}>ยืนยันรับโอน</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.billPayBtn, { backgroundColor: '#059669' }]}
                    onPress={() => setBillPayModal({
                      tableNumber: bill.tableNumber,
                      orders: bill.orders,
                      totalAmount: bill.totalAmount,
                      method: 'cash',
                      cashInput: '',
                    })}
                  >
                    <Ionicons name="cash-outline" size={16} color="#fff" />
                    <Text style={styles.billPayBtnText}>รับเงินสด</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyInlineText}>ไม่มีโต๊ะที่มีออเดอร์ค้างอยู่</Text>
        )}
      </ScrollView>
      ) : (
      /* ===== Tab Content: ประวัติ ===== */
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              if (!shop?.id) return;
              setRefreshing(true);
              fetchOrderHistory(shop.id, getDateRange(historyDateRange), historyStatusFilter, HISTORY_PAGE_SIZE, 0)
                .finally(() => setRefreshing(false));
            }}
          />
        }
      >
        {/* ===== Section 3: ประวัติออเดอร์ ===== */}
        {/* Filters card */}
        <View style={styles.historyFiltersCard}>
          {/* Date range pills */}
          <View style={styles.historyFilterGroup}>
            {([
              { key: 'today' as const, label: 'วันนี้' },
              { key: 'yesterday' as const, label: 'เมื่อวาน' },
              { key: '7days' as const, label: '7 วัน' },
              { key: '30days' as const, label: '30 วัน' },
            ]).map(d => (
              <TouchableOpacity
                key={d.key}
                style={[styles.filterPill, historyDateRange === d.key ? styles.filterPillActive : styles.filterPillInactive]}
                onPress={() => { setHistoryDateRange(d.key); refreshHistory(d.key); }}
              >
                <Text style={[styles.filterPillText, historyDateRange === d.key ? styles.filterPillTextActive : styles.filterPillTextInactive]}>
                  {d.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.historyFilterDivider} />

          {/* Status filter pills */}
          <View style={styles.historyFilterGroup}>
            {([
              { key: 'all' as const, label: 'ทั้งหมด' },
              { key: 'completed' as const, label: 'เสร็จสิ้น' },
              { key: 'cancelled' as const, label: 'ยกเลิก' },
            ]).map(s => (
              <TouchableOpacity
                key={s.key}
                style={[styles.filterPill, historyStatusFilter === s.key ? styles.filterPillActive : styles.filterPillInactive]}
                onPress={() => { setHistoryStatusFilter(s.key); refreshHistory(undefined, s.key); }}
              >
                <Text style={[styles.filterPillText, historyStatusFilter === s.key ? styles.filterPillTextActive : styles.filterPillTextInactive]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Summary bar */}
        {historyOrders.length > 0 && (
          <View style={styles.historySummary}>
            <View style={styles.historySummaryItem}>
              <Text style={styles.historySummaryValue}>
                ฿{historyOrders.filter(o => o.status === 'completed').reduce((s, o) => s + (o.total_amount ?? 0), 0).toLocaleString('th-TH')}
              </Text>
              <Text style={styles.historySummaryLabel}>ยอดขาย</Text>
            </View>
            <View style={styles.historySummaryDivider} />
            <View style={styles.historySummaryItem}>
              <Text style={styles.historySummaryValue}>
                {historyOrders.filter(o => o.status === 'completed' && o.payment?.method === 'cash').length}
              </Text>
              <Text style={styles.historySummaryLabel}>เงินสด</Text>
            </View>
            <View style={styles.historySummaryDivider} />
            <View style={styles.historySummaryItem}>
              <Text style={styles.historySummaryValue}>
                {historyOrders.filter(o => o.status === 'completed' && o.payment?.method === 'qr').length}
              </Text>
              <Text style={styles.historySummaryLabel}>โอน/QR</Text>
            </View>
            <View style={styles.historySummaryDivider} />
            <View style={styles.historySummaryItem}>
              <Text style={[styles.historySummaryValue, { color: '#EF4444' }]}>
                {historyOrders.filter(o => o.status === 'cancelled').length}
              </Text>
              <Text style={styles.historySummaryLabel}>ยกเลิก</Text>
            </View>
          </View>
        )}

        {/* History cards */}
        {historyLoading && historyOrders.length === 0 ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ paddingVertical: 24 }} />
        ) : historyOrders.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 32, gap: 10 }}>
            <Ionicons name="receipt-outline" size={48} color={colors.text.light} />
            <Text style={{ fontSize: 14, color: colors.text.secondary }}>ยังไม่มีประวัติออเดอร์</Text>
          </View>
        ) : (
          historyOrders.map((order) => {
            const isCancelled = order.status === 'cancelled';
            const accentColor = isCancelled ? '#EF4444' : '#10B981';
            const confirmType = order.payment?.confirmation_type;
            const confirmedName = order.confirmedByProfile?.full_name;
            const cancelledName = order.cancelledByProfile?.full_name;
            const methodIcon = order.payment?.method === 'cash' ? 'cash-outline' : 'card-outline';
            const methodLabel = methodLabels[order.payment?.method ?? ''] ?? '';
            const itemCount = order.items?.filter((i: any) => (i.item_status ?? 'active') === 'active').length ?? 0;

            return (
              <TouchableOpacity
                key={order.id}
                style={[styles.orderCard, isCancelled && { opacity: 0.7 }]}
                activeOpacity={0.7}
                onPress={() => setSelectedOrder(order)}
              >
                <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
                <View style={styles.cardBody}>
                  {/* Header: order number + status */}
                  <View style={styles.orderHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={styles.orderNumber}>#{order.order_number}</Text>
                      {order.table_number ? (
                        <View style={styles.tableTagSmall}>
                          <Text style={styles.tableTagText}>โต๊ะ {order.table_number}</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: (statusColors[order.status] ?? '#9CA3AF') + '20' }]}>
                      <Text style={[styles.statusText, { color: statusColors[order.status] ?? '#9CA3AF' }]}>
                        {statusLabels[order.status] ?? order.status}
                      </Text>
                    </View>
                  </View>

                  {/* Meta: time, items, method */}
                  <View style={styles.orderMeta}>
                    <View style={styles.detailRow}>
                      <Ionicons name="time-outline" size={13} color={colors.text.light} />
                      <Text style={styles.detailText}>
                        {new Date(order.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="cart-outline" size={13} color={colors.text.light} />
                      <Text style={styles.detailText}>{itemCount} รายการ</Text>
                    </View>
                    {methodLabel ? (
                      <View style={styles.detailRow}>
                        <Ionicons name={methodIcon as any} size={13} color={colors.text.light} />
                        <Text style={styles.detailText}>{methodLabel}</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Confirmation badge */}
                  {!isCancelled && confirmType === 'manual' && confirmedName ? (
                    <View style={[styles.confirmBadge, styles.confirmBadgeManual]}>
                      <Ionicons name="person-outline" size={12} color="#D97706" />
                      <Text style={[styles.confirmBadgeText, { color: '#D97706' }]}>
                        ยืนยันโดย {confirmedName}
                      </Text>
                    </View>
                  ) : !isCancelled && confirmType === 'auto' ? (
                    <View style={[styles.confirmBadge, styles.confirmBadgeAuto]}>
                      <Ionicons name="flash-outline" size={12} color={colors.primary} />
                      <Text style={[styles.confirmBadgeText, { color: colors.primary }]}>Auto</Text>
                    </View>
                  ) : null}

                  {/* Cancelled by badge */}
                  {isCancelled && cancelledName ? (
                    <View style={[styles.confirmBadge, { backgroundColor: '#FEF2F2' }]}>
                      <Ionicons name="close-circle-outline" size={12} color="#DC2626" />
                      <Text style={[styles.confirmBadgeText, { color: '#DC2626' }]}>
                        ยกเลิกโดย {cancelledName}
                      </Text>
                    </View>
                  ) : null}

                  {/* Footer: total */}
                  <View style={[styles.orderFooter, { marginTop: 8 }]}>
                    <Text style={styles.totalLabel}>ยอดรวม</Text>
                    <Text style={[
                      styles.totalAmount,
                      isCancelled && { textDecorationLine: 'line-through', color: colors.text.light },
                    ]}>
                      ฿{(order.total_amount ?? 0).toLocaleString('th-TH')}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* Load more button */}
        {historyOrders.length < historyTotal && (
          <TouchableOpacity
            style={styles.loadMoreBtn}
            onPress={() => {
              if (!shop?.id) return;
              const newOffset = historyOffset + HISTORY_PAGE_SIZE;
              setHistoryOffset(newOffset);
              fetchOrderHistory(shop.id, getDateRange(historyDateRange), historyStatusFilter, HISTORY_PAGE_SIZE, newOffset);
            }}
          >
            {historyLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.loadMoreText}>
                โหลดเพิ่ม ({historyOrders.length}/{historyTotal})
              </Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
      )}
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
                      <Ionicons name="checkmark-circle-outline" size={16} color={payModal.method === 'qr' ? '#fff' : colors.text.secondary} />
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

      {/* Bill payment modal (combined table) */}
      <Modal visible={!!billPayModal} transparent animationType="fade" onRequestClose={() => setBillPayModal(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <Pressable style={styles.payOverlay} onPress={() => setBillPayModal(null)}>
            <Pressable style={styles.paySheet} onPress={(e) => e.stopPropagation()}>
              {billPayModal && (
                <>
                  <Text style={styles.paySheetTitle}>ชำระเงินรวมโต๊ะ</Text>
                  <Text style={styles.paySheetOrder}>โต๊ะ {billPayModal.tableNumber} · {billPayModal.orders.length} ออเดอร์</Text>
                  <Text style={styles.paySheetTotal}>฿{billPayModal.totalAmount.toFixed(0)}</Text>

                  {/* Method selector */}
                  <Text style={styles.paySheetLabel}>วิธีชำระเงิน</Text>
                  <View style={styles.methodRow}>
                    <TouchableOpacity
                      style={[styles.methodPill, billPayModal.method === 'qr' && styles.methodPillActive]}
                      onPress={() => setBillPayModal((p) => p ? { ...p, method: 'qr', cashInput: '' } : p)}
                    >
                      <Ionicons name="checkmark-circle-outline" size={16} color={billPayModal.method === 'qr' ? '#fff' : colors.text.secondary} />
                      <Text style={[styles.methodPillText, billPayModal.method === 'qr' && styles.methodPillTextActive]}>โอน/QR</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.methodPill, billPayModal.method === 'cash' && styles.methodPillActive]}
                      onPress={() => setBillPayModal((p) => p ? { ...p, method: 'cash' } : p)}
                    >
                      <Ionicons name="cash-outline" size={16} color={billPayModal.method === 'cash' ? '#fff' : colors.text.secondary} />
                      <Text style={[styles.methodPillText, billPayModal.method === 'cash' && styles.methodPillTextActive]}>เงินสด</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Cash input */}
                  {billPayModal.method === 'cash' && (
                    <View style={styles.cashSection}>
                      <Text style={styles.paySheetLabel}>รับเงินมา (฿)</Text>
                      <TextInput
                        style={styles.cashInput}
                        value={billPayModal.cashInput}
                        onChangeText={(v) => setBillPayModal((p) => p ? { ...p, cashInput: v } : p)}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={colors.text.light}
                        autoFocus
                      />
                      {(() => {
                        const received = parseFloat(billPayModal.cashInput) || 0;
                        const total = billPayModal.totalAmount;
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
                    <TouchableOpacity style={styles.payCancelBtn} onPress={() => setBillPayModal(null)}>
                      <Text style={styles.payCancelText}>ยกเลิก</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.payConfirmBtn} onPress={handleBillPayConfirm}>
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
  //
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
    width: 220,
    ...shadow.md,
  },
  pendingCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pendingTableText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  pendingOrderNum: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
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
    color: '#64748B',
    textAlign: 'right',
    flexShrink: 0,
    maxWidth: 80,
  },
  pendingCardFooter: {
    flexDirection: 'column',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
  },
  pendingCardFooterTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pendingTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0066CC',
    flexShrink: 0,
  },
  pendingItemCount: {
    fontSize: 12,
    color: '#64748B',
    flexShrink: 0,
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
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
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
  pendingCardPink: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1.5,
    borderColor: '#FDA4AF',
  },
  pendingCardYellow: {
    backgroundColor: '#FEFCE8',
    borderWidth: 1.5,
    borderColor: '#FCD34D',
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
  historyFiltersCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 12,
    marginBottom: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyFilterGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  historyFilterDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: -12,
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
  // Tab switcher
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: colors.primary,
  },
  tabLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  tabLabelActive: {
    fontWeight: '700',
    color: colors.primary,
  },
  tabBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tabBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  tabBadgeAlert: {
    backgroundColor: '#EF4444',
  },
  tabBadgeAlertText: {
    color: '#FFFFFF',
  },
  // History section
  historySummary: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 12,
    ...shadow.sm,
  },
  historySummaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  historySummaryValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
    fontVariant: ['tabular-nums'] as any,
  },
  historySummaryLabel: {
    fontSize: 11,
    color: colors.text.light,
    fontWeight: '500',
  },
  historySummaryDivider: {
    width: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 2,
  },
  loadMoreBtn: {
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 10,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchIconBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: colors.borderLight,
  },
  emptyInlineText: {
    fontSize: 14,
    color: colors.text.light,
    paddingVertical: 12,
  },
  // Table bill cards
  billCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    ...shadow.md,
  },
  billHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  billTableNum: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  billOrderCount: {
    fontSize: 13,
    color: colors.text.secondary,
    backgroundColor: colors.borderLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  billOrderCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  billOrderNum: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  billOrderPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
    fontVariant: ['tabular-nums'] as any,
  },
  billOrderSection: {
    marginBottom: 4,
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  billOrderItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 24,
    paddingVertical: 2,
  },
  billOrderItemName: {
    fontSize: 13,
    color: colors.text.secondary,
    flex: 1,
  },
  billOrderItemQty: {
    fontSize: 13,
    color: colors.text.light,
    marginLeft: 8,
  },
  orderStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  orderStatusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  billCancelAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  billCancelAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },
  billCancelBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
  },
  billItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
    gap: 4,
  },
  billItemCancelBtn: {
    padding: 4,
    marginLeft: 2,
  },
  billItemName: {
    fontSize: 14,
    color: colors.text.primary,
    flex: 1,
  },
  billItemQty: {
    fontSize: 14,
    color: colors.text.secondary,
    marginHorizontal: 12,
  },
  billItemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    fontVariant: ['tabular-nums'] as any,
  },
  billTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1.5,
    borderTopColor: colors.border,
  },
  billTotalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  billTotalAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
    fontVariant: ['tabular-nums'] as any,
    letterSpacing: -0.5,
  },
  billPayBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  billPayBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  billPayBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  billEmptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  billEmptyText: {
    fontSize: 15,
    color: colors.text.light,
    marginTop: 12,
  },
});
