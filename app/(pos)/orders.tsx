import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOrderStore } from '../../src/store/orderStore';
import { useAuthStore } from '../../src/store/authStore';
import { OrderWithItems } from '../../src/types';
import { OrderDetailModal } from '../../components/OrderDetailModal';
import { Colors } from '../../constants/colors';

const statusColors: Record<string, string> = {
  pending: '#F59E0B',
  confirmed: '#0F766E',
  completed: '#059669',
  cancelled: '#EF4444',
};

const statusLabels: Record<string, string> = {
  pending: 'รอดำเนินการ',
  confirmed: 'ยืนยันแล้ว',
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
  const orders = useOrderStore((s) => s.orders);
  const fetchOrders = useOrderStore((s) => s.fetchOrders);
  const isLoading = useOrderStore((s) => s.isLoading);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);

  useEffect(() => {
    if (shop?.id) {
      fetchOrders(shop.id);
    }
  }, [shop?.id]);

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const date = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    return `${date}  ${time}`;
  };

  const renderOrder = ({ item }: { item: OrderWithItems }) => {
    const accentColor = statusColors[item.status] || '#9CA3AF';
    return (
      <TouchableOpacity style={styles.orderCard} activeOpacity={0.7} onPress={() => setSelectedOrder(item)}>
        {/* Left accent bar */}
        <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

        <View style={styles.cardBody}>
          <View style={styles.orderHeader}>
            <Text style={styles.orderNumber}>#{item.order_number}</Text>
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

          {item.payment?.confirmation_type ? (
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

          <View style={styles.orderFooter}>
            <Text style={styles.totalLabel}>ยอดรวม</Text>
            <Text style={styles.totalAmount}>฿{(item.total_amount ?? 0).toFixed(2)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading && orders.length === 0) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrder}
        contentContainerStyle={styles.listContent}
        onRefresh={() => shop?.id && fetchOrders(shop.id)}
        refreshing={isLoading}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color={Colors.text.light} />
            <Text style={styles.emptyText}>ยังไม่มีรายการ</Text>
          </View>
        }
      />
      <OrderDetailModal
        visible={selectedOrder !== null}
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
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
    padding: 16,
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
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
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
});
