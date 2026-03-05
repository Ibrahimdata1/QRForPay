import '../global.css';
import { useEffect } from 'react';
import { Stack, router, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../constants/colors';
import { useAuthStore } from '../src/store/authStore';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';

// Routes that are public and must render immediately without auth initialization.
// These are served to end-customers via QR code and must never be blocked by
// the auth spinner or redirected to login.
const PUBLIC_ROUTES = ['/customer'];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((prefix) => pathname.startsWith(prefix));
}

export default function RootLayout() {
  // Preload Ionicons font so tab-bar icons render correctly on web.
  useFonts(Ionicons.font);

  const isInitialized = useAuthStore((s) => s.isInitialized);
  const user = useAuthStore((s) => s.user);
  const initialize = useAuthStore((s) => s.initialize);
  const pathname = usePathname();

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    // Customer self-ordering pages are public — never redirect them.
    // We check pathname HERE (not just in the isInitialized guard) so that even
    // if this effect fires before isInitialized, we do not redirect a customer.
    if (isPublicRoute(pathname)) return;
    if (!isInitialized) return;
    if (user) {
      router.replace('/(pos)');
    } else {
      router.replace('/(auth)/login');
    }
  // pathname is intentionally excluded from deps: re-running on every tab
  // navigation would call router.replace() on each tab press, creating a ghost
  // navigation layer that blocks all touch events.
  // The public-route guard above is safe because public routes are never
  // user-session-dependent and the pathname is stable once the URL is set.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, user]);

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
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
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
