import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { CartItem } from '../../components/CartItem';
import {
  useCartStore,
  selectSubtotal,
  selectTaxAmount,
  selectGrandTotal,
  selectDiscountAmount,
} from '../../src/store/cartStore';
import { useOrderStore } from '../../src/store/orderStore';
import { useAuthStore } from '../../src/store/authStore';

export default function CartScreen() {
  const items = useCartStore((s) => s.items);
  const discount = useCartStore((s) => s.discount);
  const taxRate = useCartStore((s) => s.taxRate);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart);

  const subtotal = useCartStore(selectSubtotal);
  const taxAmount = useCartStore(selectTaxAmount);
  const total = useCartStore(selectGrandTotal);

  const createOrder = useOrderStore((s) => s.createOrder);
  const shop = useAuthStore((s) => s.shop);
  const profile = useAuthStore((s) => s.profile);

  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountInput, setDiscountInput] = useState('');
  const discountAmount = useCartStore(selectDiscountAmount);
  const applyDiscount = useCartStore((s) => s.applyDiscount);

  const handleApplyDiscount = () => {
    const val = parseFloat(discountInput);
    if (!isNaN(val) && val >= 0 && val <= 100) {
      applyDiscount(val);
    }
    setShowDiscountModal(false);
    setDiscountInput('');
  };

  const handlePayment = () => {
    if (items.length === 0) {
      Alert.alert('ตะกร้าว่าง', 'กรุณาเพิ่มสินค้า / Cart is empty');
      return;
    }
    Alert.alert(
      'ยืนยันการชำระเงิน / Confirm Payment',
      `ยอดรวม / Total: ฿${total.toFixed(2)}\nชำระผ่าน QR PromptPay`,
      [
        { text: 'ยกเลิก / Cancel', style: 'cancel' },
        {
          text: 'ยืนยัน / Confirm',
          onPress: async () => {
            if (!shop?.id || !profile?.id) return;
            setIsCreatingOrder(true);
            try {
              const order = await createOrder(
                shop.id,
                profile.id,
                items,
                'qr',
                discount,
                taxRate
              );
              clearCart();
              router.push({ pathname: '/qr-payment', params: { orderId: order.id } });
            } catch (err: any) {
              Alert.alert(
                'เกิดข้อผิดพลาด / Error',
                err.message || 'ไม่สามารถสร้างออเดอร์ได้ / Could not create order'
              );
            } finally {
              setIsCreatingOrder(false);
            }
          },
        },
      ]
    );
  };

  const handleClearCart = () => {
    Alert.alert(
      'ล้างตะกร้า / Clear Cart',
      'ต้องการล้างตะกร้าทั้งหมด? / Remove all items?',
      [
        { text: 'ยกเลิก / Cancel', style: 'cancel' },
        { text: 'ล้าง / Clear', style: 'destructive', onPress: clearCart },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {isCreatingOrder && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>กำลังสร้างออเดอร์... / Creating order...</Text>
        </View>
      )}

      {items.length > 0 && (
        <View style={styles.topBar}>
          <Text style={styles.itemCountText}>
            {items.length} รายการ / {items.length} item{items.length > 1 ? 's' : ''}
          </Text>
          <TouchableOpacity onPress={handleClearCart} style={styles.clearButton}>
            <Ionicons name="trash-outline" size={16} color={Colors.danger} />
            <Text style={styles.clearButtonText}>ล้างตะกร้า / Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={(item) => item.product.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <CartItem
            name={item.product.name}
            price={item.product.price}
            quantity={item.quantity}
            onIncrement={() => updateQuantity(item.product.id, item.quantity + 1)}
            onDecrement={() => updateQuantity(item.product.id, item.quantity - 1)}
            onRemove={() => removeItem(item.product.id)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cart-outline" size={64} color={Colors.text.light} />
            <Text style={styles.emptyText}>ตะกร้าว่าง / Cart is empty</Text>
          </View>
        }
      />

      <View style={styles.summaryContainer}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>ยอดรวม / Subtotal</Text>
          <Text style={styles.summaryValue}>฿{subtotal.toFixed(2)}</Text>
        </View>
        {/* Discount row — always visible with button */}
        <TouchableOpacity
          style={styles.discountRow}
          onPress={() => {
            setDiscountInput(discount > 0 ? String(discount) : '');
            setShowDiscountModal(true);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.discountLeft}>
            <Ionicons name="pricetag-outline" size={16} color={discount > 0 ? '#EF4444' : '#9CA3AF'} />
            <Text style={[styles.summaryLabel, discount > 0 && { color: '#EF4444' }]}>
              {discount > 0 ? `ส่วนลด ${discount}%` : 'เพิ่มส่วนลด'}
            </Text>
          </View>
          <Text style={[styles.summaryValue, discount > 0 && { color: '#EF4444' }]}>
            {discount > 0 ? `-฿${discountAmount.toFixed(2)}` : '—'}
          </Text>
        </TouchableOpacity>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>ภาษี VAT 7%</Text>
          <Text style={styles.summaryValue}>฿{taxAmount.toFixed(2)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryRow}>
          <Text style={styles.totalLabel}>รวมทั้งหมด / Total</Text>
          <Text style={styles.totalValue}>฿{total.toFixed(2)}</Text>
        </View>

        <TouchableOpacity
          style={[styles.payButton, (items.length === 0 || isCreatingOrder) && styles.payButtonDisabled]}
          onPress={handlePayment}
          disabled={items.length === 0 || isCreatingOrder}
          activeOpacity={0.85}
        >
          <Ionicons name="qr-code" size={24} color={Colors.surface} />
          <Text style={styles.payButtonText}>
            {`ชำระเงิน QR / Pay ฿${total.toFixed(2)}`}
          </Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showDiscountModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.discountOverlay}
          activeOpacity={1}
          onPress={() => setShowDiscountModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.discountSheet}>
            <Text style={styles.discountTitle}>ส่วนลด / Discount</Text>
            <View style={styles.discountInputWrap}>
              <TextInput
                style={styles.discountInput}
                value={discountInput}
                onChangeText={setDiscountInput}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                maxLength={3}
                autoFocus
              />
              <Text style={styles.discountPercent}>%</Text>
            </View>
            <Text style={styles.discountHint}>กรอก 0–100</Text>
            <View style={styles.discountBtns}>
              {discount > 0 && (
                <TouchableOpacity
                  style={styles.discountClearBtn}
                  onPress={() => { applyDiscount(0); setShowDiscountModal(false); setDiscountInput(''); }}
                >
                  <Text style={styles.discountClearText}>ลบส่วนลด</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.discountApplyBtn} onPress={handleApplyDiscount}>
                <Text style={styles.discountApplyText}>ยืนยัน</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0FDF9',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  itemCountText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearButtonText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingBottom: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 12,
  },
  summaryContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
    borderTopWidth: 1,
    borderColor: '#D1FAE5',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  divider: {
    height: 1,
    backgroundColor: '#D1FAE5',
    marginVertical: 8,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#134E4A',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F766E',
  },
  payButton: {
    backgroundColor: '#0F766E',
    borderRadius: 14,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  payButtonDisabled: {
    opacity: 0.5,
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  discountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 4,
  },
  discountLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  discountOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  discountSheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    alignItems: 'center',
  },
  discountTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#134E4A',
    marginBottom: 16,
  },
  discountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#D1FAE5',
    borderRadius: 14,
    paddingHorizontal: 20,
    height: 60,
    gap: 4,
  },
  discountInput: {
    fontSize: 32,
    fontWeight: '700',
    color: '#134E4A',
    minWidth: 60,
    textAlign: 'center',
  },
  discountPercent: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F766E',
  },
  discountHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 6,
    marginBottom: 20,
  },
  discountBtns: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  discountClearBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  discountClearText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  discountApplyBtn: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#0F766E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  discountApplyText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
