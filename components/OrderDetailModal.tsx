import { useRef, useEffect } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView,
  Animated, StyleSheet, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OrderWithItems } from '../src/types';
import { useProductStore } from '../src/store/productStore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  cash: 'เงินสด / Cash',
  card: 'บัตร / Card',
};

interface OrderDetailModalProps {
  order: OrderWithItems | null;
  visible: boolean;
  onClose: () => void;
}

export function OrderDetailModal({ order, visible, onClose }: OrderDetailModalProps) {
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const products = useProductStore((s) => s.products);
  const productMap = Object.fromEntries(products.map((p) => [p.id, p.name]));

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  if (!order) return null;

  const formatDateTime = (str: string) => {
    const d = new Date(str);
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
      + ' ' + d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  };

  const statusColor = statusColors[order.status] || '#9CA3AF';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      {/* Bottom Sheet */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Handle bar */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.sheetHeader}>
          <View>
            <Text style={styles.orderTitle}>ออเดอร์ #{order.order_number}</Text>
            <Text style={styles.orderDate}>{formatDateTime(order.created_at)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {statusLabels[order.status] || order.status}
            </Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollContent}>
          {/* Items */}
          <Text style={styles.sectionTitle}>รายการสินค้า</Text>
          {order.items?.map((item, idx) => (
            <View key={item.id ?? idx} style={styles.itemRow}>
              <View style={styles.itemLeft}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {productMap[item.product_id] || `สินค้า #${idx + 1}`}
                </Text>
                <Text style={styles.itemUnit}>
                  {item.quantity} × ฿{item.unit_price.toFixed(0)}
                </Text>
              </View>
              <Text style={styles.itemSubtotal}>฿{item.subtotal.toFixed(0)}</Text>
            </View>
          ))}

          {/* Summary */}
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>ยอดรวม</Text>
            <Text style={styles.summaryValue}>฿{(order.subtotal ?? 0).toFixed(2)}</Text>
          </View>
          {(order.discount_amount ?? 0) > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: '#EF4444' }]}>ส่วนลด</Text>
              <Text style={[styles.summaryValue, { color: '#EF4444' }]}>
                -฿{(order.discount_amount ?? 0).toFixed(2)}
              </Text>
            </View>
          )}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>VAT 7%</Text>
            <Text style={styles.summaryValue}>฿{(order.tax_amount ?? 0).toFixed(2)}</Text>
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>รวมทั้งหมด</Text>
            <Text style={styles.totalValue}>฿{(order.total_amount ?? 0).toFixed(2)}</Text>
          </View>

          {/* Payment method */}
          {order.payment_method && (
            <View style={styles.paymentRow}>
              <Ionicons name="card-outline" size={16} color="#6B7280" />
              <Text style={styles.paymentText}>
                {methodLabels[order.payment_method] || order.payment_method}
              </Text>
              {order.payment?.confirmation_type === 'manual' && (
                <View style={styles.confirmBadge}>
                  <Text style={styles.confirmBadgeText}>ยืนยันเอง</Text>
                </View>
              )}
              {order.payment?.confirmation_type === 'auto' && (
                <View style={[styles.confirmBadge, { backgroundColor: '#D1FAE5' }]}>
                  <Text style={[styles.confirmBadgeText, { color: '#059669' }]}>Auto</Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* Close */}
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
          <Text style={styles.closeBtnText}>ปิด / Close</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.8,
    paddingBottom: 34,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1FAE5',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#D1FAE5',
  },
  orderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#134E4A',
  },
  orderDate: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0FDF9',
  },
  itemLeft: { flex: 1, marginRight: 12 },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#134E4A',
  },
  itemUnit: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  itemSubtotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F766E',
  },
  divider: {
    height: 1,
    backgroundColor: '#D1FAE5',
    marginVertical: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: 14,
    color: '#134E4A',
    fontWeight: '500',
  },
  totalRow: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#D1FAE5',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#134E4A',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F766E',
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    marginBottom: 4,
  },
  paymentText: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  confirmBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  confirmBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D97706',
  },
  closeBtn: {
    marginHorizontal: 20,
    marginTop: 16,
    height: 50,
    backgroundColor: '#0F766E',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
