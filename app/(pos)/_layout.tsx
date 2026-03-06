import { Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, Alert, Platform, View, Vibration, ActivityIndicator } from 'react-native';
import { useRef, useEffect } from 'react';
import { shadow } from '../../constants/theme';
import { useAuthStore } from '../../src/store/authStore';
import { useOrderStore } from '../../src/store/orderStore';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../constants/ThemeContext';

export default function POSLayout() {
  const { colors } = useTheme();
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const signOut = useAuthStore((s) => s.signOut);
  const shop = useAuthStore((s) => s.shop);
  const profile = useAuthStore((s) => s.profile);
  const isSuperAdmin = profile?.role === 'super_admin';
  const orders = useOrderStore((s) => s.orders);
  const fetchOrders = useOrderStore((s) => s.fetchOrders);
  const addNewOrderIds = useOrderStore((s) => s.addNewOrderIds);
  const setAlertInfo = useOrderStore((s) => s.setAlertInfo);

  const knownOrderIds = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  // Initial fetch + always-on realtime subscription (layout stays mounted on all tabs)
  useEffect(() => {
    if (!shop?.id) return;
    fetchOrders(shop.id); // initial fetch to populate knownOrderIds
    const channel = supabase
      .channel('pos-layout-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `shop_id=eq.${shop.id}` },
        () => { fetchOrders(shop.id); }
      )
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [shop?.id]);

  // Detect new pending orders and alert
  useEffect(() => {
    if (orders.length === 0) return;
    // First load: just register known IDs, no alert
    if (!initializedRef.current) {
      orders.forEach((o) => knownOrderIds.current.add(o.id));
      initializedRef.current = true;
      return;
    }
    const newPending = orders.filter(
      (o) => o.status === 'pending' && !knownOrderIds.current.has(o.id)
    );
    if (newPending.length > 0) {
      Vibration.vibrate([0, 400, 150, 400]);
      const latest = newPending[newPending.length - 1];
      setAlertInfo({
        orderNum: latest.order_number,
        tableNum: (latest as any).table_number ?? undefined,
      });
      setTimeout(() => setAlertInfo(null), 6000);
      // Track new order IDs in store so orders screen can highlight them
      addNewOrderIds(newPending.map((o) => o.id));
    }
    orders.forEach((o) => knownOrderIds.current.add(o.id));
  }, [orders]);

  const handleLogout = async () => {
    // On web use window.confirm (works reliably), on native use Alert
    let confirmed = false;
    if (Platform.OS === 'web') {
      confirmed = window.confirm('ออกจากระบบ\n\nต้องการออกจากระบบ?');
    } else {
      await new Promise<void>((resolve) => {
        Alert.alert('ออกจากระบบ', 'ต้องการออกจากระบบ?', [
          { text: 'ยกเลิก', style: 'cancel', onPress: resolve },
          {
            text: 'ออกจากระบบ',
            style: 'destructive',
            onPress: () => {
              signOut().then(() => router.replace('/(auth)/login')).finally(resolve);
            },
          },
        ]);
      });
      return;
    }
    if (confirmed) {
      await signOut();
      router.replace('/(auth)/login');
    }
  };

  // Show loading screen until auth initializes to prevent flashing wrong tab content
  if (!isInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text.light,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.borderLight,
          borderTopWidth: 1,
          height: Platform.OS === 'web' ? 80 : 72,
          paddingBottom: Platform.OS === 'web' ? 28 : 16,
          paddingTop: 8,
          ...shadow.bottom,
        },
        tabBarShowLabel: Platform.OS !== 'web',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
          borderBottomWidth: 1,
        },
        headerTintColor: colors.text.primary,
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
        },
        headerRight: () => (
          <TouchableOpacity onPress={handleLogout} style={{ marginRight: 16 }}>
            <Ionicons name="log-out-outline" size={24} color={colors.text.secondary} />
          </TouchableOpacity>
        ),
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'แดชบอร์ด',
          headerTitle: 'สรุปยอดขาย',
          href: isSuperAdmin ? null : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'ออเดอร์',
          headerTitle: 'รายการสั่งซื้อ',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'สินค้า',
          headerTitle: 'จัดการสินค้า',
          href: isSuperAdmin ? null : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tables"
        options={{
          title: 'โต๊ะ',
          headerTitle: 'จัดการโต๊ะ',
          href: isSuperAdmin ? null : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'ตั้งค่า',
          headerTitle: 'ตั้งค่าร้าน',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
      {/* Hidden routes — no tab icon */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="inventory" options={{ href: null }} />
      <Tabs.Screen
        name="cart"
        options={{
          href: null,
          title: 'ตะกร้า',
          headerTitle: 'ตะกร้าสินค้า',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cart" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
    </View>
  );
}
