import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

interface OrderItem {
  name: string;
  price: number;
  quantity: number;
}

interface OrderSummaryProps {
  orderNumber: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: string;
  date: string;
}

export function OrderSummary({
  orderNumber,
  items,
  subtotal,
  tax,
  discount,
  total,
  paymentMethod,
  date,
}: OrderSummaryProps) {
  return (
    <View style={styles.receipt}>
      <View style={styles.header}>
        <Text style={styles.storeName}>EasyShop</Text>
        <Text style={styles.receiptTitle}>ใบเสร็จรับเงิน / Receipt</Text>
        <Text style={styles.orderNumber}>{orderNumber}</Text>
        <Text style={styles.date}>{date}</Text>
      </View>

      <View style={styles.dashedLine} />

      <View style={styles.itemsSection}>
        <View style={styles.itemHeader}>
          <Text style={[styles.itemHeaderText, { flex: 1 }]}>รายการ</Text>
          <Text style={[styles.itemHeaderText, { width: 35, textAlign: 'center' }]}>จำนวน</Text>
          <Text style={[styles.itemHeaderText, { width: 70, textAlign: 'right' }]}>ราคา</Text>
        </View>
        {items.map((item, index) => (
          <View key={index} style={styles.itemRow}>
            <Text style={[styles.itemText, { flex: 1 }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.itemText, { width: 35, textAlign: 'center' }]}>
              {item.quantity}
            </Text>
            <Text style={[styles.itemText, { width: 70, textAlign: 'right' }]}>
              ฿{(item.price * item.quantity).toFixed(2)}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.dashedLine} />

      <View style={styles.totalsSection}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>ยอดรวม / Subtotal</Text>
          <Text style={styles.totalValue}>฿{subtotal.toFixed(2)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>VAT 7%</Text>
          <Text style={styles.totalValue}>฿{tax.toFixed(2)}</Text>
        </View>
        {discount > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>ส่วนลด / Discount</Text>
            <Text style={[styles.totalValue, { color: Colors.danger }]}>-฿{discount.toFixed(2)}</Text>
          </View>
        )}
        <View style={[styles.totalRow, styles.grandTotalRow]}>
          <Text style={styles.grandTotalLabel}>รวมทั้งหมด / Total</Text>
          <Text style={styles.grandTotalValue}>฿{total.toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.dashedLine} />

      <View style={styles.footer}>
        <Text style={styles.paymentMethod}>ช่องทาง: {paymentMethod}</Text>
        <Text style={styles.thankYou}>ขอบคุณที่ใช้บริการ</Text>
        <Text style={styles.thankYouEn}>Thank you for your purchase!</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  receipt: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    alignItems: 'center',
    marginBottom: 12,
  },
  storeName: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.primary,
  },
  receiptTitle: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: 8,
  },
  date: {
    fontSize: 12,
    color: Colors.text.light,
    marginTop: 2,
  },
  dashedLine: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    borderStyle: 'dashed',
    marginVertical: 12,
  },
  itemsSection: {},
  itemHeader: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  itemHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.light,
  },
  itemRow: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  itemText: {
    fontSize: 13,
    color: Colors.text.primary,
  },
  totalsSection: {},
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  totalLabel: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  totalValue: {
    fontSize: 13,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 6,
    paddingTop: 8,
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
  },
  footer: {
    alignItems: 'center',
  },
  paymentMethod: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  thankYou: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  thankYouEn: {
    fontSize: 12,
    color: Colors.text.light,
    marginTop: 2,
  },
});
