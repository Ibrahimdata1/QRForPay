// Customer-facing layout — no authentication required.
// This group is accessed via QR code scan: /customer?shop=<shopId>&table=<num>
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { Colors } from '../../constants/colors';

// Error boundary: catches render crashes in the customer subtree and shows a
// friendly message instead of a blank white screen.  Without this, any uncaught
// exception during render would silently unmount the whole React tree on web,
// leaving the customer with a white page and no indication of what went wrong.
interface ErrorState {
  hasError: boolean;
  message: string;
}

class CustomerErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorState {
    return {
      hasError: true,
      message: (error as any)?.message ?? 'เกิดข้อผิดพลาดที่ไม่คาดคิด',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>😕</Text>
          <Text style={styles.errorTitle}>โหลดหน้าไม่ได้</Text>
          <Text style={styles.errorBody}>{this.state.message}</Text>
          <Text style={styles.errorHint}>กรุณาสแกน QR โต๊ะใหม่อีกครั้ง</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function CustomerLayout() {
  return (
    <CustomerErrorBoundary>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="customer" />
      </Stack>
    </CustomerErrorBoundary>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 32,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  errorBody: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  errorHint: {
    fontSize: 13,
    color: Colors.text.light,
    textAlign: 'center',
  },
});
