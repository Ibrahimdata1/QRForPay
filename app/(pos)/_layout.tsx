import { Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, Alert, Platform } from 'react-native';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../src/store/authStore';

export default function POSLayout() {
  const signOut = useAuthStore((s) => s.signOut);

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

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.text.light,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'web' ? 80 : 72,
          paddingBottom: Platform.OS === 'web' ? 28 : 16,
          paddingTop: 8,
        },
        tabBarShowLabel: Platform.OS !== 'web',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: Colors.surface,
          borderBottomColor: Colors.border,
          borderBottomWidth: 1,
        },
        headerTintColor: Colors.text.primary,
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
        },
        headerRight: () => (
          <TouchableOpacity onPress={handleLogout} style={{ marginRight: 16 }}>
            <Ionicons name="log-out-outline" size={24} color={Colors.text.secondary} />
          </TouchableOpacity>
        ),
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'แดชบอร์ด',
          headerTitle: 'สรุปยอดขาย',
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
  );
}
