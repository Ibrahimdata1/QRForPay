import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { QRPaymentModal } from '../components/QRPaymentModal';
import { useOrderStore } from '../src/store/orderStore';
import { useAuthStore } from '../src/store/authStore';
import { useCartStore } from '../src/store/cartStore';
import { useTheme, ThemeColors } from '../constants/ThemeContext';

export default function QRPaymentScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const currentOrder = useOrderStore((s) => s.currentOrder);
  const subscribeToOrder = useOrderStore((s) => s.subscribeToOrder);
  const completeOrder = useOrderStore((s) => s.completeOrder);
  const profile = useAuthStore((s) => s.profile);
  const shop = useAuthStore((s) => s.shop);
  const clearCart = useCartStore((s) => s.clearCart);
  const [loadTimedOut, setLoadTimedOut] = useState(false);

  useEffect(() => {
    if (currentOrder) return;
    const t = setTimeout(() => setLoadTimedOut(true), 10000);
    return () => clearTimeout(t);
  }, [currentOrder]);

  useEffect(() => {
    if (!orderId) return;

    const unsubscribe = subscribeToOrder(orderId);
    return () => {
      unsubscribe();
    };
  }, [orderId]);

  const handleConfirmed = () => {
    clearCart();
    router.replace('/(pos)');
  };

  const handleManualConfirm = async () => {
    if (!orderId || !profile) return;
    try {
      await completeOrder(orderId, {}, 'manual', profile.id);
      clearCart();
      router.replace('/(pos)');
    } catch {
      // Best effort
    }
  };

  const handleCancel = async () => {
    if (orderId) {
      try {
        await useOrderStore.getState().cancelOrder(orderId, profile?.id ?? '');
      } catch {
        // Best effort cancellation
      }
    }
    router.back();
  };

  // B-4: onExpired no longer auto-cancels. It just marks the QR as expired.
  // Cancel only happens when user explicitly presses the cancel button.
  const handleExpired = () => {
    // Do nothing here — modal already shows expired state.
    // User must press "ยกเลิก" to cancel the order.
  };

  // B-1: When load timed out (order created in DB but screen couldn't load it),
  // cancel the order and clear cart before going back to prevent duplicate orders.
  const handleTimeoutBack = async () => {
    if (orderId) {
      try {
        await useOrderStore.getState().cancelOrder(orderId, profile?.id ?? '', 'timeout');
      } catch {
        // Best effort
      }
    }
    clearCart();
    router.back();
  };

  if (!orderId || (!currentOrder && !loadTimedOut)) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading order...</Text>
      </View>
    );
  }

  if (!currentOrder) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.loadingText}>ไม่พบออเดอร์ กรุณาลองใหม่</Text>
        <TouchableOpacity onPress={handleTimeoutBack} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.primary, fontSize: 15, fontWeight: '600' }}>กลับ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const amount = currentOrder.total_amount ?? 0;
  const qrPayload = currentOrder.payment?.qr_payload;

  return (
    <View style={styles.container}>
      <QRPaymentModal
        amount={amount}
        qrPayload={qrPayload ?? undefined}
        promptPayId={shop?.promptpay_id ?? undefined}
        paymentStatus={currentOrder.payment?.status}
        onConfirmed={handleConfirmed}
        onCancel={handleCancel}
        onExpired={handleExpired}
        onManualConfirm={handleManualConfirm}
        cashierName={profile?.full_name}
      />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.text.secondary,
  },
});
