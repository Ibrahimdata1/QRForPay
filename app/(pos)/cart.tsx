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
  KeyboardAvoidingView,
  Platform,
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
  const [discountType, setDiscountType] = useState<'percent' | 'baht'>('percent');
  const discountAmount = useCartStore(selectDiscountAmount);
  const applyDiscount = useCartStore((s) => s.applyDiscount);

  // Payment method selector
  const [paymentMethod, setPaymentMethod] = useState<'qr' | 'cash'>('qr');

  // Cash received input
  const [cashReceived, setCashReceived] = useState('');

  // Compute effective discount amount for display when discountType is 'baht'
  // The cart store always stores discount as a percentage; for baht mode we compute locally.
  const discountBahtValue = discountType === 'baht'
    ? Math.min(parseFloat(discountInput || '0') || 0, subtotal)
    : discountAmount;

  // Effective total shown in summary
  const effectiveTotal = discountType === 'baht'
    ? Math.max(0, subtotal - discountBahtValue)
    : total;

  // Change calculation for cash payment
  const cashReceivedNum = parseFloat(cashReceived) || 0;
  const change = cashReceivedNum - effectiveTotal;

  const handleApplyDiscount = () => {
    const val = parseFloat(discountInput);
    if (discountType === 'percent') {
      if (!isNaN(val) && val >= 0 && val <= 100) {
        applyDiscount(val);
      }
    } else {
      // Baht mode: store as percentage equivalent so cart store is consistent
      if (!isNaN(val) && val >= 0) {
        const cappedBaht = Math.min(val, subtotal);
        const pct = subtotal > 0 ? (cappedBaht / subtotal) * 100 : 0;
        applyDiscount(pct);
      }
    }
    setShowDiscountModal(false);
    setDiscountInput('');
  };

  const getDiscountLabel = () => {
    if (discount <= 0) return 'เพิ่มส่วนลด';
    const amt = discountAmount;
    return `ส่วนลด -฿${amt.toFixed(0)}`;
  };

  const handlePayment = () => {
    if (items.length === 0) {
      Alert.alert('ตะกร้าว่าง', 'กรุณาเพิ่มสินค้า');
      return;
    }

    if (paymentMethod === 'cash') {
      handleCashPayment();
      return;
    }

    // QR payment flow
    Alert.alert(
      'ยืนยันการชำระเงิน',
      `ยอดรวม ฿${effectiveTotal.toFixed(2)}\nชำระผ่าน QR PromptPay`,
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ยืนยัน',
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
              // clearCart ควรย้ายไปใน qr-payment screen หลัง payment success
              // เพื่อป้องกันตะกร้าหายก่อนที่ผู้ใช้จะชำระเงินจริง
              router.push({ pathname: '/qr-payment', params: { orderId: order.id } });
            } catch (err: any) {
              Alert.alert(
                'เกิดข้อผิดพลาด',
                err.message || 'ไม่สามารถสร้างออเดอร์ได้'
              );
            } finally {
              setIsCreatingOrder(false);
            }
          },
        },
      ]
    );
  };

  const handleCashPayment = async () => {
    if (!shop?.id || !profile?.id) return;

    const currentTotal = effectiveTotal;

    if (paymentMethod === 'cash' && cashReceivedNum === 0) {
      Alert.alert('กรุณากรอกจำนวนเงินที่รับมา');
      return;
    }

    if (cashReceivedNum > 0 && cashReceivedNum < currentTotal) {
      Alert.alert('จำนวนเงินไม่เพียงพอ', `ยอดที่ต้องชำระ ฿${currentTotal.toFixed(0)}`);
      return;
    }

    const confirmMsg = cashReceivedNum >= currentTotal
      ? `ยอดรวม ฿${currentTotal.toFixed(0)}\nรับเงิน ฿${cashReceivedNum.toFixed(0)}\nทอน ฿${(cashReceivedNum - currentTotal).toFixed(0)}`
      : `ยอดรวม ฿${currentTotal.toFixed(0)}\nชำระด้วยเงินสด`;

    Alert.alert('ยืนยันรับเงินสด', confirmMsg, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ยืนยัน',
        onPress: async () => {
          setIsCreatingOrder(true);
          try {
            await createOrder(
              shop.id,
              profile.id,
              items,
              'cash',
              discount,
              taxRate
            );
            clearCart();
            setCashReceived('');
            if (cashReceivedNum > currentTotal) {
              Alert.alert('ทอนเงิน', `฿${(cashReceivedNum - currentTotal).toFixed(0)}`);
            }
            router.replace('/(pos)/orders');
          } catch (err: any) {
            Alert.alert(
              'เกิดข้อผิดพลาด',
              err.message || 'ไม่สามารถสร้างออเดอร์ได้'
            );
          } finally {
            setIsCreatingOrder(false);
          }
        },
      },
    ]);
  };

  const handleClearCart = () => {
    Alert.alert(
      'ล้างตะกร้า',
      'ต้องการล้างตะกร้าทั้งหมด?',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        { text: 'ล้าง', style: 'destructive', onPress: clearCart },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {isCreatingOrder && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>กำลังสร้างออเดอร์...</Text>
        </View>
      )}

      {items.length > 0 && (
        <View style={styles.topBar}>
          <Text style={styles.itemCountText}>
            {items.length} รายการ
          </Text>
          <TouchableOpacity onPress={handleClearCart} style={styles.clearButton}>
            <Ionicons name="trash-outline" size={16} color={Colors.danger} />
            <Text style={styles.clearButtonText}>ล้างตะกร้า</Text>
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
            <Text style={styles.emptyText}>ตะกร้าว่าง</Text>
          </View>
        }
      />

      <View style={styles.summaryContainer}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>ยอดรวม</Text>
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
            <Ionicons name="pricetag-outline" size={16} color={discount > 0 ? Colors.danger : Colors.text.light} />
            <Text style={[styles.summaryLabel, discount > 0 && { color: Colors.danger }]}>
              {discount > 0 ? `ส่วนลด -฿${discountAmount.toFixed(0)}` : 'เพิ่มส่วนลด'}
            </Text>
          </View>
          <Text style={[styles.summaryValue, discount > 0 && { color: Colors.danger }]}>
            {discount > 0 ? `-฿${discountAmount.toFixed(2)}` : '—'}
          </Text>
        </TouchableOpacity>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>ภาษี VAT 7%</Text>
          <Text style={styles.summaryValue}>฿{taxAmount.toFixed(2)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryRow}>
          <Text style={styles.totalLabel}>รวมทั้งหมด</Text>
          <Text style={styles.totalValue}>฿{effectiveTotal.toFixed(2)}</Text>
        </View>

        {/* Payment method selector */}
        <View style={styles.methodRow}>
          <TouchableOpacity
            style={[
              styles.methodPill,
              paymentMethod === 'qr' && styles.methodPillActive,
              paymentMethod !== 'qr' && styles.methodPillInactive,
            ]}
            onPress={() => setPaymentMethod('qr')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="qr-code-outline"
              size={16}
              color={paymentMethod === 'qr' ? '#FFFFFF' : Colors.text.secondary}
            />
            <Text style={[
              styles.methodPillText,
              paymentMethod === 'qr' ? styles.methodPillTextActive : styles.methodPillTextInactive,
            ]}>
              QR PromptPay
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.methodPill,
              paymentMethod === 'cash' && styles.methodPillActive,
              paymentMethod !== 'cash' && styles.methodPillInactive,
            ]}
            onPress={() => setPaymentMethod('cash')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="cash-outline"
              size={16}
              color={paymentMethod === 'cash' ? '#FFFFFF' : Colors.text.secondary}
            />
            <Text style={[
              styles.methodPillText,
              paymentMethod === 'cash' ? styles.methodPillTextActive : styles.methodPillTextInactive,
            ]}>
              เงินสด
            </Text>
          </TouchableOpacity>
        </View>

        {/* Cash received input — shown only when cash is selected */}
        {paymentMethod === 'cash' && (
          <View style={styles.cashSection}>
            <Text style={styles.cashLabel}>รับเงินมา (฿)</Text>
            <TextInput
              style={styles.cashInput}
              value={cashReceived}
              onChangeText={setCashReceived}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={Colors.text.light}
              returnKeyType="done"
            />
            {cashReceivedNum > 0 && change >= 0 && (
              <Text style={styles.changeText}>
                ทอน: ฿{change.toFixed(0)}
              </Text>
            )}
          </View>
        )}

        <TouchableOpacity
          style={[styles.payButton, (items.length === 0 || isCreatingOrder) && styles.payButtonDisabled]}
          onPress={handlePayment}
          disabled={items.length === 0 || isCreatingOrder}
          activeOpacity={0.85}
        >
          <Ionicons
            name={paymentMethod === 'qr' ? 'qr-code' : 'cash'}
            size={24}
            color={Colors.surface}
          />
          <Text style={styles.payButtonText}>
            {`ชำระเงิน ฿${effectiveTotal.toFixed(0)}`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Discount modal */}
      <Modal visible={showDiscountModal} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.discountOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              if (discountInput !== '') {
                Alert.alert(
                  'ยกเลิกการกรอกส่วนลด?',
                  'ข้อมูลที่กรอกจะหายไป',
                  [
                    { text: 'ยกเลิก', style: 'cancel' },
                    {
                      text: 'ออก',
                      style: 'destructive',
                      onPress: () => {
                        setDiscountInput('');
                        setShowDiscountModal(false);
                      },
                    },
                  ]
                );
              } else {
                setShowDiscountModal(false);
              }
            }}
          />
          <View style={styles.discountSheet}>
            <Text style={styles.discountTitle}>ส่วนลด</Text>

            {/* Discount type toggle */}
            <View style={styles.discountTypeRow}>
              <TouchableOpacity
                style={[
                  styles.discountTypePill,
                  discountType === 'percent' && styles.discountTypePillActive,
                  discountType !== 'percent' && styles.discountTypePillInactive,
                ]}
                onPress={() => { setDiscountType('percent'); setDiscountInput(''); }}
              >
                <Text style={[
                  styles.discountTypePillText,
                  discountType === 'percent' ? styles.discountTypePillTextActive : styles.discountTypePillTextInactive,
                ]}>%</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.discountTypePill,
                  discountType === 'baht' && styles.discountTypePillActive,
                  discountType !== 'baht' && styles.discountTypePillInactive,
                ]}
                onPress={() => { setDiscountType('baht'); setDiscountInput(''); }}
              >
                <Text style={[
                  styles.discountTypePillText,
                  discountType === 'baht' ? styles.discountTypePillTextActive : styles.discountTypePillTextInactive,
                ]}>฿</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.discountInputWrap}>
              <TextInput
                style={styles.discountInput}
                value={discountInput}
                onChangeText={setDiscountInput}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={Colors.text.light}
                maxLength={discountType === 'percent' ? 3 : 7}
                autoFocus
              />
              <Text style={styles.discountPercent}>
                {discountType === 'percent' ? '%' : '฿'}
              </Text>
            </View>
            <Text style={styles.discountHint}>
              {discountType === 'percent' ? 'กรอก 0–100' : `กรอกจำนวนเงิน (สูงสุด ฿${subtotal.toFixed(0)})`}
            </Text>
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
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
    color: Colors.text.secondary,
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
    color: Colors.text.secondary,
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
    color: Colors.danger,
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
    fontSize: 15,
    color: Colors.text.light,
    marginTop: 12,
  },
  summaryContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 8,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.primary,
  },
  // Payment method selector
  methodRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    marginBottom: 4,
  },
  methodPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 21,
  },
  methodPillActive: {
    backgroundColor: Colors.primary,
  },
  methodPillInactive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  methodPillText: {
    fontSize: 14,
    fontWeight: '600',
  },
  methodPillTextActive: {
    color: '#FFFFFF',
  },
  methodPillTextInactive: {
    color: Colors.text.secondary,
  },
  // Cash received section
  cashSection: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    gap: 6,
  },
  cashLabel: {
    fontSize: 13,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  cashInput: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
    paddingBottom: 4,
  },
  changeText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.success,
    marginTop: 2,
  },
  payButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
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
    color: Colors.text.primary,
    marginBottom: 14,
  },
  // Discount type toggle pills
  discountTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  discountTypePill: {
    width: 52,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  discountTypePillActive: {
    backgroundColor: Colors.primary,
  },
  discountTypePillInactive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  discountTypePillText: {
    fontSize: 16,
    fontWeight: '700',
  },
  discountTypePillTextActive: {
    color: '#FFFFFF',
  },
  discountTypePillTextInactive: {
    color: Colors.text.secondary,
  },
  discountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 20,
    height: 60,
    gap: 4,
  },
  discountInput: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.text.primary,
    minWidth: 60,
    textAlign: 'center',
  },
  discountPercent: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.primary,
  },
  discountHint: {
    fontSize: 12,
    color: Colors.text.light,
    marginTop: 6,
    marginBottom: 20,
    textAlign: 'center',
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
    color: Colors.danger,
  },
  discountApplyBtn: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  discountApplyText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
