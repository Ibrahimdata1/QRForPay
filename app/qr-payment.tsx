import { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { QRPaymentModal } from '../components/QRPaymentModal';
import { Colors } from '../constants/colors';
import { useOrderStore } from '../src/store/orderStore';
import { useAuthStore } from '../src/store/authStore';

export default function QRPaymentScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const currentOrder = useOrderStore((s) => s.currentOrder);
  const subscribeToOrder = useOrderStore((s) => s.subscribeToOrder);
  const completeOrder = useOrderStore((s) => s.completeOrder);
  const profile = useAuthStore((s) => s.profile);

  useEffect(() => {
    if (!orderId) return;

    const unsubscribe = subscribeToOrder(orderId);
    return () => {
      unsubscribe();
    };
  }, [orderId]);

  const handleConfirmed = () => {
    router.replace('/(pos)');
  };

  const handleManualConfirm = async () => {
    if (!orderId || !profile) return;
    try {
      await completeOrder(orderId, {}, 'manual', profile.id);
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
        <ActivityIndicator size="large" color={Colors.primary} />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.text.secondary,
  },
});
