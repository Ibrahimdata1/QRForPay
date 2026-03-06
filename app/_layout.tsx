import '../global.css';
import { useEffect } from 'react';
import { Stack, Redirect, router, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { useAuthStore } from '../src/store/authStore';
import { useOrderStore } from '../src/store/orderStore';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { ThemeProvider, useTheme } from '../constants/ThemeContext';

// Routes that are public and must render immediately without auth initialization.
// These are served to end-customers via QR code and must never be blocked by
// the auth spinner or redirected to login.
const PUBLIC_ROUTES = ['/customer'];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((prefix) => pathname.startsWith(prefix));
}

function AppShell() {
  const { colors, isDark } = useTheme();
  // Preload Ionicons font so tab-bar icons render correctly on web.
  useFonts(Ionicons.font);

  const isInitialized = useAuthStore((s) => s.isInitialized);
  const user = useAuthStore((s) => s.user);
  const initialize = useAuthStore((s) => s.initialize);
  const pathname = usePathname();
  const alertInfo = useOrderStore((s) => s.alertInfo);
  const setAlertInfo = useOrderStore((s) => s.setAlertInfo);

  useEffect(() => {
    initialize();
  }, []);

  const profile = useAuthStore((s) => s.profile);

  // Compute redirect target (render-based via <Redirect> to avoid timing issues)
  const isPublic = isPublicRoute(pathname);
  let redirectTarget: string | null = null;
  if (!isPublic && isInitialized) {
    if (!user) {
      redirectTarget = '/(auth)/login';
    } else if (profile === null || profile.role === null) {
      redirectTarget = '/(auth)/pending';
    } else if (profile.role === 'super_admin') {
      redirectTarget = '/(pos)/settings';
    } else {
      redirectTarget = '/(pos)/orders';
    }
  }

  // Avoid redirecting if we're already on the target path
  const alreadyThere = redirectTarget && pathname.includes(redirectTarget.replace('/(pos)', '').replace('/(auth)', ''));

  return (
    <>
      {redirectTarget && !alreadyThere && <Redirect href={redirectTarget as any} />}
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/pending" options={{ headerShown: false }} />
        <Stack.Screen name="(pos)" options={{ headerShown: false }} />
        {/* Customer self-ordering — no auth required, opened via table QR code */}
        <Stack.Screen name="(customer)" options={{ headerShown: false }} />
        <Stack.Screen
          name="qr-payment"
          options={{
            presentation: 'fullScreenModal',
            headerShown: false,
          }}
        />
      </Stack>
      {alertInfo ? (
        <TouchableOpacity
          style={rootStyles.newOrderBanner}
          activeOpacity={0.85}
          onPress={() => setAlertInfo(null)}
        >
          <Ionicons name="notifications" size={18} color="#FFFFFF" />
          <Text style={rootStyles.newOrderBannerText}>
            {`ออเดอร์ใหม่ #${alertInfo.orderNum}${alertInfo.tableNum ? ` โต๊ะ ${alertInfo.tableNum}` : ''} เข้ามาแล้ว!`}
          </Text>
          <Ionicons name="close" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      ) : null}
    </>
  );
}

const rootStyles = StyleSheet.create({
  newOrderBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : Platform.OS === 'android' ? 36 : 0,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    zIndex: 99999,
    elevation: 99999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  newOrderBannerText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}
