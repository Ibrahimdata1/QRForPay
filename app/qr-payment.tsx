import { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
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
        await useOrderStore.getState().updateOrderStatus(orderId, 'cancelled');
      } catch {
        // Best effort cancellation
      }
    }
    router.back();
  };

  const handleExpired = async () => {
    if (orderId) {
      try {
        await useOrderStore.getState().updateOrderStatus(orderId, 'cancelled');
      } catch {
        // Best effort
      }
    }
  };

  if (!orderId || !currentOrder) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading order...</Text>
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
