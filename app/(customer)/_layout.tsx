// Customer-facing layout — no authentication required.
// This group is accessed via QR code scan: /customer?shop=<shopId>&table=<num>
import { Stack } from 'expo-router';

export default function CustomerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
