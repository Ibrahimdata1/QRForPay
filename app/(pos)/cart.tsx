import { useState, useMemo } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { shadow, radius } from '../../constants/theme';
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
import { useTheme, ThemeColors } from '../../constants/ThemeContext';

export default function CartScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const items = useCartStore((s) => s.items);
  const discount = useCartStore((s) => s.discount);
  const taxRate = useCartStore((s) => s.taxRate);
  const resumeOrderId = useCartStore((s) => s.resumeOrderId);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clearCart = useCartStore((s) => s.clearCart);
  const clearResumeOrder = useCartStore((s) => s.clearResumeOrder);

  const subtotal = useCartStore(selectSubtotal);
  const taxAmount = useCartStore(selectTaxAmount);
  const total = useCartStore(selectGrandTotal);

  const createOrder = useOrderStore((s) => s.createOrder);
  const addItemsToOrder = useOrderStore((s) => s.addItemsToOrder);
  const completeOrder = useOrderStore((s) => s.completeOrder);
  const shop = useAuthStore((s) => s.shop);
  const profile = useAuthStore((s) => s.profile);

  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountInput, setDiscountInput] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'baht'>('percent');
  const discountAmount = useCartStore(selectDiscountAmount);
  const applyDiscount = useCartStore((s) => s.applyDiscount);

  // Table number
  const [tableNumber, setTableNumber] = useState('');

  // Payment method selector
  const [paymentMethod, setPaymentMethod] = useState<'qr' | 'cash'>('qr');

  // Cash received input
  const [cashReceived, setCashReceived] = useState('');

  // Compute effective discount amount for display when discountType is 'baht'
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
      if (isNaN(val) || val < 0 || val > 100) {
        Alert.alert('ส่วนลดไม่ถูกต้อง', 'กรอกตัวเลข 0–100');
        return;
      }
      applyDiscount(val);
    } else {
      if (isNaN(val) || val < 0) {
        Alert.alert('ส่วนลดไม่ถูกต้อง', 'กรอกจำนวนเงินที่ถูกต้อง');
        return;
      }
      const cappedBaht = Math.min(val, subtotal);
      const pct = subtotal > 0 ? (cappedBaht / subtotal) * 100 : 0;
      applyDiscount(pct);
    }
    setShowDiscountModal(false);
    setDiscountInput('');
  };

  // Save as pending order (table management: no payment yet)
  const handleSaveOrder = () => {
    if (items.length === 0) {
      Alert.alert('ตะกร้าว่าง', 'กรุณาเพิ่มสินค้าก่อนบันทึกออเดอร์');
      return;
    }
    if (!shop?.id || !profile?.id) return;

    const tableLabel = tableNumber.trim() ? `โต๊ะ ${tableNumber.trim()}` : 'ไม่ระบุโต๊ะ';
    Alert.alert(
      'บันทึกออเดอร์',
      `บันทึกเป็น pending (${tableLabel})\nลูกค้าจะชำระเงินทีหลัง`,
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'บันทึก',
          onPress: async () => {
            setIsCreatingOrder(true);
            try {
              if (resumeOrderId) {
                // Resume mode: add new items to existing order
                await addItemsToOrder(resumeOrderId, items, discount, taxRate);
                clearResumeOrder();
              } else {
                // New order, status stays pending (no payment yet)
                await createOrder(
                  shop.id,
                  profile.id,
                  items,
                  'qr', // default method; actual payment collected later
                  discount,
                  taxRate,
                  tableNumber.trim() || null
                );
                clearCart();
              }
              router.replace('/(pos)/orders');
            } catch (err: any) {
              Alert.alert('เกิดข้อผิดพลาด', err.message || 'ไม่สามารถบันทึกออเดอร์ได้');
            } finally {
              setIsCreatingOrder(false);
            }
          },
        },
      ]
    );
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
              let orderId: string;
              if (resumeOrderId) {
                // Resume mode: finalise existing order
                await addItemsToOrder(resumeOrderId, items, discount, taxRate);
                orderId = resumeOrderId;
                clearResumeOrder();
              } else {
                const order = await createOrder(
                  shop.id,
                  profile.id,
                  items,
                  'qr',
                  discount,
                  taxRate,
                  tableNumber.trim() || null
                );
                orderId = order.id;
              }
              router.push({ pathname: '/qr-payment', params: { orderId } });
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

    if (paymentMethod === 'cash' && (cashReceivedNum <= 0 || isNaN(cashReceivedNum))) {
      Alert.alert('กรุณากรอกจำนวนเงินที่ถูกต้อง');
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
            let orderId: string;
            if (resumeOrderId) {
              await addItemsToOrder(resumeOrderId, items, discount, taxRate);
              orderId = resumeOrderId;
              clearResumeOrder();
            } else {
              const order = await createOrder(
                shop.id,
                profile.id,
                items,
                'cash',
                discount,
                taxRate,
                tableNumber.trim() || null
              );
              orderId = order.id;
            }
            // Cash is accepted in person — complete immediately
            await completeOrder(orderId, {
              cash_received: cashReceivedNum || null,
              cash_change: cashReceivedNum > 0 ? cashReceivedNum - currentTotal : null,
            }, 'manual', profile.id);
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
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>กำลังสร้างออเดอร์...</Text>
        </View>
      )}

      {/* Resume order banner */}
      {resumeOrderId ? (
        <View style={styles.resumeBanner}>
          <Ionicons name="refresh-circle-outline" size={16} color="#0F766E" />
          <Text style={styles.resumeBannerText}>เพิ่มสินค้าในออเดอร์เดิม</Text>
        </View>
      ) : null}

      {/* Table number input */}
      {!resumeOrderId && (
        <View style={styles.tableRow}>
          <Ionicons name="grid-outline" size={18} color={colors.text.secondary} />
          <TextInput
            style={styles.tableInput}
            placeholder="หมายเลขโต๊ะ (ไม่บังคับ)"
            placeholderTextColor={colors.text.light}
            value={tableNumber}
            onChangeText={setTableNumber}
            keyboardType="default"
            maxLength={10}
          />
        </View>
      )}

      {items.length > 0 && (
        <View style={styles.topBar}>
          <Text style={styles.itemCountText}>
            {items.length} รายการ
          </Text>
          <TouchableOpacity onPress={handleClearCart} style={styles.clearButton}>
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
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
            onDecrement={() => {
              if (item.quantity <= 1) {
                Alert.alert(
                  'ลบสินค้า',
                  `ต้องการลบ "${item.product.name}" ออกจากตะกร้า?`,
                  [
                    { text: 'ยกเลิก', style: 'cancel' },
                    { text: 'ลบ', style: 'destructive', onPress: () => removeItem(item.product.id) },
                  ]
                );
              } else {
                updateQuantity(item.product.id, item.quantity - 1);
              }
            }}
            onRemove={() =>
              Alert.alert(
                'ลบสินค้า',
                `ต้องการลบ "${item.product.name}" ออกจากตะกร้า?`,
                [
                  { text: 'ยกเลิก', style: 'cancel' },
                  { text: 'ลบ', style: 'destructive', onPress: () => removeItem(item.product.id) },
                ]
              )
            }
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cart-outline" size={64} color={colors.text.light} />
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
            <Ionicons name="pricetag-outline" size={16} color={discount > 0 ? colors.danger : colors.text.light} />
            <Text style={[styles.summaryLabel, discount > 0 && { color: colors.danger }]}>
              {discount > 0 ? `ส่วนลด -฿${discountAmount.toFixed(0)}` : 'เพิ่มส่วนลด'}
            </Text>
          </View>
          <Text style={[styles.summaryValue, discount > 0 && { color: colors.danger }]}>
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
              color={paymentMethod === 'qr' ? '#FFFFFF' : colors.text.secondary}
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
              color={paymentMethod === 'cash' ? '#FFFFFF' : colors.text.secondary}
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
              onChangeText={(t) => setCashReceived(t.replace(/[^0-9.]/g, ''))}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.text.light}
              maxLength={10}
            />
            {cashReceivedNum > 0 && change >= 0 && (
              <Text style={styles.changeText}>
                ทอน: ฿{change.toFixed(0)}
              </Text>
            )}
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.actionRow}>
          {/* Save Order (pending) button */}
          <TouchableOpacity
            style={[styles.saveOrderButton, (items.length === 0 || isCreatingOrder) && styles.actionButtonDisabled]}
            onPress={handleSaveOrder}
            disabled={items.length === 0 || isCreatingOrder}
            activeOpacity={0.85}
          >
            <Ionicons name="save-outline" size={20} color="#FFFFFF" />
            <Text style={styles.saveOrderButtonText}>
              {resumeOrderId ? 'บันทึกเพิ่ม' : 'บันทึกออเดอร์'}
            </Text>
          </TouchableOpacity>

          {/* Pay button — LinearGradient CTA */}
          <TouchableOpacity
            style={[(items.length === 0 || isCreatingOrder) && styles.actionButtonDisabled, styles.payButtonWrapper]}
            onPress={handlePayment}
            disabled={items.length === 0 || isCreatingOrder}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={colors.gradient.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.payButton}
            >
              <Ionicons
                name={paymentMethod === 'qr' ? 'qr-code' : 'cash'}
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.payButtonText}>
                {`ชำระ ฿${effectiveTotal.toLocaleString('th-TH', { maximumFractionDigits: 0 })}`}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
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
                placeholderTextColor={colors.text.light}
                maxLength={discountType === 'percent' ? 5 : 7}
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

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    color: colors.text.secondary,
  },
  resumeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderBottomWidth: 1,
    borderBottomColor: '#A7F3D0',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  resumeBannerText: {
    fontSize: 13,
    color: '#0F766E',
    fontWeight: '600',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text.primary,
    height: 36,
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
    color: colors.text.secondary,
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
    color: colors.danger,
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
    color: colors.text.light,
    marginTop: 12,
  },
  summaryContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    padding: 20,
    ...shadow.bottom,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  summaryValue: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'] as any,
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
    backgroundColor: colors.primary,
  },
  methodPillInactive: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  methodPillText: {
    fontSize: 14,
    fontWeight: '600',
  },
  methodPillTextActive: {
    color: '#FFFFFF',
  },
  methodPillTextInactive: {
    color: colors.text.secondary,
  },
  // Cash received section
  cashSection: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    gap: 6,
  },
  cashLabel: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  cashInput: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    paddingBottom: 4,
  },
  changeText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.success,
    marginTop: 2,
  },
  // Action buttons row
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  saveOrderButton: {
    flex: 1,
    backgroundColor: colors.success,
    borderRadius: radius.md,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  saveOrderButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  payButtonWrapper: {
    flex: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    ...shadow.md,
  },
  payButton: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.md,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  discountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 10,
    backgroundColor: colors.background,
    opacity: 0.9,
  },
  discountLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  discountOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  discountSheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    ...shadow.lg,
  },
  discountTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 14,
  },
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
    backgroundColor: colors.primary,
  },
  discountTypePillInactive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  discountTypePillText: {
    fontSize: 16,
    fontWeight: '700',
  },
  discountTypePillTextActive: {
    color: '#FFFFFF',
  },
  discountTypePillTextInactive: {
    color: colors.text.secondary,
  },
  discountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 20,
    height: 60,
    gap: 4,
  },
  discountInput: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text.primary,
    minWidth: 60,
    textAlign: 'center',
  },
  discountPercent: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
  },
  discountHint: {
    fontSize: 12,
    color: colors.text.light,
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
    color: colors.danger,
  },
  discountApplyBtn: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  discountApplyText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
