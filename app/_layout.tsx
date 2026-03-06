import '../global.css';
import { useEffect } from 'react';
import { Stack, router, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../src/store/authStore';
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

  useEffect(() => {
    initialize();
  }, []);

  const profile = useAuthStore((s) => s.profile);

  useEffect(() => {
    // Customer self-ordering pages are public — never redirect them.
    if (isPublicRoute(pathname)) return;
    if (!isInitialized) return;

    if (!user) {
      router.replace('/(auth)/login');
      return;
    }

    // Pending: signed in via Google but not yet approved by owner
    if (profile === null || profile.role === null) {
      router.replace('/(auth)/pending');
      return;
    }

    router.replace('/(pos)');
  // pathname intentionally excluded — see comment in previous version
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, user, profile?.role]);

  // Always render the Stack so that:
  // 1. Public routes (customer QR page) are never blocked by auth loading.
  // 2. There is no "spinner → Stack" remount that causes a white flash on web.
  //
  // Auth-required routes (pos, auth) handle their own loading state via the
  // redirect above — they will be sent to /(auth)/login before they render.
  // The Stack's contentStyle provides the background colour so the screen is
  // never bare-white between route transitions.
  return (
    <>
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
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}
