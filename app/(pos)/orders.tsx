import { useEffect } from 'react';
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

const statusColors: Record<string, string> = {
  pending: '#F59E0B',
  confirmed: '#0F766E',
  completed: '#059669',
  cancelled: '#EF4444',
};

const statusLabels: Record<string, string> = {
  pending: 'รอดำเนินการ / Pending',
  confirmed: 'ยืนยันแล้ว / Confirmed',
  completed: 'สำเร็จ / Completed',
  cancelled: 'ยกเลิก / Cancelled',
};

const methodLabels: Record<string, string> = {
  qr: 'QR PromptPay',
  cash: 'เงินสด / Cash',
  card: 'บัตร / Card',
};

export default function OrdersScreen() {
  const shop = useAuthStore((s) => s.shop);
  const orders = useOrderStore((s) => s.orders);
  const fetchOrders = useOrderStore((s) => s.fetchOrders);
  const isLoading = useOrderStore((s) => s.isLoading);

  useEffect(() => {
    if (shop?.id) {
      fetchOrders(shop.id);
    }
  }, [shop?.id]);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  };

  const renderOrder = ({ item }: { item: OrderWithItems }) => (
    <TouchableOpacity style={styles.orderCard} activeOpacity={0.7}>
      <View style={styles.orderHeader}>
        <Text style={styles.orderNumber}>#{item.order_number}</Text>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: (statusColors[item.status] || '#9CA3AF') + '20' },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              { color: statusColors[item.status] || '#9CA3AF' },
            ]}
          >
            {statusLabels[item.status] || item.status}
          </Text>
        </View>
      </View>
      <View style={styles.orderDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={16} color={'#9CA3AF'} />
          <Text style={styles.detailText}>{formatDate(item.created_at)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={16} color={'#9CA3AF'} />
          <Text style={styles.detailText}>{formatTime(item.created_at)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="cube-outline" size={16} color={'#9CA3AF'} />
          <Text style={styles.detailText}>{item.items?.length ?? 0} items</Text>
        </View>
        {item.payment_method ? (
          <View style={styles.detailRow}>
            <Ionicons name="card-outline" size={16} color={'#9CA3AF'} />
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
              <Ionicons name="hand-left-outline" size={12} color="#D97706" />
              <Text style={[styles.confirmBadgeText, { color: '#D97706' }]}>ยืนยันเอง</Text>
              {item.confirmedByProfile?.full_name ? (
                <Text style={[styles.confirmBadgeText, { color: '#D97706' }]}>
                  {' '}· {item.confirmedByProfile.full_name}
                </Text>
              ) : null}
            </View>
          ) : (
            <View style={[styles.confirmBadge, styles.confirmBadgeAuto]}>
              <Ionicons name="flash-outline" size={12} color={'#0F766E'} />
              <Text style={[styles.confirmBadgeText, { color: '#0F766E' }]}>Auto</Text>
            </View>
          )}
        </View>
      ) : null}
      <View style={styles.orderFooter}>
        <Text style={styles.totalLabel}>รวม / Total</Text>
        <Text style={styles.totalAmount}>฿{(item.total_amount ?? 0).toFixed(2)}</Text>
      </View>
    </TouchableOpacity>
  );

  if (isLoading && orders.length === 0) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={'#0F766E'} />
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
            <Ionicons name="receipt-outline" size={64} color={'#9CA3AF'} />
            <Text style={styles.emptyText}>ยังไม่มีรายการ / No orders yet</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0FDF9',
  },
  listContent: {
    padding: 16,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#134E4A',
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
  orderDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 13,
    color: '#6B7280',
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
    backgroundColor: '#D1FAE5',
  },
  confirmBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#D1FAE5',
    paddingTop: 12,
  },
  totalLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F766E',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 12,
  },
});
