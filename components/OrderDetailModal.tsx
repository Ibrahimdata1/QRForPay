import { useRef, useEffect, useMemo } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView,
  Animated, StyleSheet, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OrderWithItems } from '../src/types';
import { useProductStore } from '../src/store/productStore';
import { Colors } from '../constants/colors';

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
  cash: 'เงินสด',
  card: 'บัตรเครดิต',
};

interface OrderDetailModalProps {
  order: OrderWithItems | null;
  visible: boolean;
  onClose: () => void;
  onCancel?: (order: OrderWithItems) => void;
  onPayPending?: (order: OrderWithItems) => void;
}

export function OrderDetailModal({ order, visible, onClose, onCancel, onPayPending }: OrderDetailModalProps) {
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const products = useProductStore((s) => s.products);
  const productMap = useMemo(
    () => Object.fromEntries(products.map((p) => [p.id, p.name])),
    [products]
  );

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
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', calendar: 'gregory' })
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
          <View style={{ flex: 1, marginRight: 12 }}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.orderTitle}>ออเดอร์ #{order.order_number}</Text>
              {order.table_number ? (
                <View style={styles.tableChip}>
                  <Ionicons name="grid-outline" size={12} color="#0F766E" />
                  <Text style={styles.tableChipText}>โต๊ะ {order.table_number}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.orderDate}>{formatDateTime(order.created_at)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '1A' }]}>
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
                  {productMap[item.product_id] || (item as any).product_name || (item as any).name || `สินค้า #${idx + 1}`}
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
              <Text style={[styles.summaryLabel, { color: Colors.danger }]}>ส่วนลด</Text>
              <Text style={[styles.summaryValue, { color: Colors.danger }]}>
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
              <Ionicons name="card-outline" size={16} color={Colors.text.secondary} />
              <Text style={styles.paymentText}>
                {methodLabels[order.payment_method] || order.payment_method}
              </Text>
              {order.payment?.confirmation_type === 'manual' && (
                <View style={styles.confirmBadge}>
                  <Text style={styles.confirmBadgeText}>ยืนยันเอง</Text>
                </View>
              )}
              {order.payment?.confirmation_type === 'auto' && (
                <View style={[styles.confirmBadge, { backgroundColor: Colors.primaryLight }]}>
                  <Text style={[styles.confirmBadgeText, { color: Colors.secondary }]}>อัตโนมัติ</Text>
                </View>
              )}
            </View>
          )}

          {/* Cash received / change */}
          {order.payment?.method === 'cash' && order.payment?.cash_received != null && (
            <View style={styles.cashInfoBox}>
              <View style={styles.cashInfoRow}>
                <Text style={styles.cashInfoLabel}>รับเงินมา</Text>
                <Text style={styles.cashInfoValue}>฿{order.payment.cash_received.toFixed(0)}</Text>
              </View>
              {order.payment.cash_change != null && (
                <View style={styles.cashInfoRow}>
                  <Text style={styles.cashInfoLabel}>ทอนเงิน</Text>
                  <Text style={[styles.cashInfoValue, { color: Colors.success }]}>
                    ฿{order.payment.cash_change.toFixed(0)}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Cancelled info */}
          {order.status === 'cancelled' && (
            <View style={styles.cancelInfoBox}>
              <Ionicons name="close-circle-outline" size={16} color="#EF4444" />
              <View style={{ flex: 1 }}>
                <Text style={styles.cancelInfoTitle}>
                  ยกเลิกเมื่อ {order.cancelled_at ? formatDateTime(order.cancelled_at) : '—'}
                </Text>
                {order.cancelledByProfile?.full_name && (
                  <Text style={styles.cancelInfoSub}>
                    โดย: {order.cancelledByProfile.full_name}
                  </Text>
                )}
                {order.cancel_reason && (
                  <Text style={styles.cancelInfoSub}>เหตุผล: {order.cancel_reason}</Text>
                )}
              </View>
            </View>
          )}

          <View style={{ height: 16 }} />
        </ScrollView>

        {/* Buttons */}
        <View style={styles.btnRow}>
          {(order.status === 'pending' || order.status === 'confirmed') && onCancel && (
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => onCancel(order)}
              activeOpacity={0.8}
            >
              <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
              <Text style={styles.cancelBtnText}>ยกเลิก</Text>
            </TouchableOpacity>
          )}
          {order.status === 'pending' && onPayPending && (
            <TouchableOpacity
              style={styles.payPendingBtn}
              onPress={() => { onClose(); onPayPending(order); }}
              activeOpacity={0.8}
            >
              <Ionicons name="cash-outline" size={18} color="#FFFFFF" />
              <Text style={styles.payPendingBtnText}>ชำระเงิน</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.closeBtnText}>ปิด</Text>
          </TouchableOpacity>
        </View>
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
    backgroundColor: '#DEE2E6',
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
    borderBottomColor: Colors.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  orderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  tableChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tableChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F766E',
  },
  orderDate: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    flexShrink: 0,
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
    color: Colors.text.secondary,
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
    borderBottomColor: Colors.borderLight,
  },
  itemLeft: { flex: 1, marginRight: 12 },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  itemUnit: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  itemSubtotal: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  summaryValue: {
    fontSize: 14,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  totalRow: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
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
    color: Colors.text.secondary,
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
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
  },
  payPendingBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: Colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  payPendingBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeBtn: {
    flex: 1,
    height: 50,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cashInfoBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    gap: 4,
  },
  cashInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cashInfoLabel: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  cashInfoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  cancelInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  cancelInfoTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
  },
  cancelInfoSub: {
    fontSize: 12,
    color: '#B91C1C',
    marginTop: 2,
  },
});
