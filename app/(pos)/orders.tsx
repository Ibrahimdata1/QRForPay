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
import { Colors } from '../../constants/colors';
import { useOrderStore } from '../../src/store/orderStore';
import { useAuthStore } from '../../src/store/authStore';
import { OrderWithItems } from '../../src/types';

const statusColors: Record<string, string> = {
  pending: Colors.warning,
  confirmed: Colors.primary,
  completed: Colors.secondary,
  cancelled: Colors.danger,
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
            { backgroundColor: (statusColors[item.status] || Colors.text.light) + '20' },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              { color: statusColors[item.status] || Colors.text.light },
            ]}
          >
            {statusLabels[item.status] || item.status}
          </Text>
        </View>
      </View>
      <View style={styles.orderDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={16} color={Colors.text.light} />
          <Text style={styles.detailText}>{formatDate(item.created_at)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={16} color={Colors.text.light} />
          <Text style={styles.detailText}>{formatTime(item.created_at)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="cube-outline" size={16} color={Colors.text.light} />
          <Text style={styles.detailText}>{item.items?.length ?? 0} items</Text>
        </View>
        {item.payment_method ? (
          <View style={styles.detailRow}>
            <Ionicons name="card-outline" size={16} color={Colors.text.light} />
            <Text style={styles.detailText}>
              {methodLabels[item.payment_method] || item.payment_method}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.orderFooter}>
        <Text style={styles.totalLabel}>รวม / Total</Text>
        <Text style={styles.totalAmount}>฿{(item.total_amount ?? 0).toFixed(2)}</Text>
      </View>
    </TouchableOpacity>
  );

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
    backgroundColor: Colors.background,
  },
  listContent: {
    padding: 16,
  },
  orderCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
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
    color: Colors.text.secondary,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
  },
  totalLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.text.light,
    marginTop: 12,
  },
});
