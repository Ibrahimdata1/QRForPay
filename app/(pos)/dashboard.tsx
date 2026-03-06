import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/store/authStore';
import { shadow, radius } from '../../constants/theme';
import { useTheme, ThemeColors } from '../../constants/ThemeContext';

interface DashboardStats {
  totalSales: number;
  orderCount: number;
  avgPerOrder: number;
}

interface TopProduct {
  product_id: string;
  product_name: string;
  total_qty: number;
  total_revenue: number;
}

export default function DashboardScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const shop = useAuthStore((s) => s.shop);
  const [stats, setStats] = useState<DashboardStats>({ totalSales: 0, orderCount: 0, avgPerOrder: 0 });
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!shop?.id) return;

    // Today's date range (local midnight → end of day)
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

    setFetchError(null);

    try {
      // Fetch completed orders for today
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, total_amount')
        .eq('shop_id', shop.id)
        .eq('status', 'completed')
        .gte('created_at', startOfDay)
        .lt('created_at', endOfDay);

      if (ordersError) throw ordersError;

      const orderCount = orders?.length ?? 0;
      const totalSales = orders?.reduce((sum, o) => sum + (o.total_amount ?? 0), 0) ?? 0;
      const avgPerOrder = orderCount > 0 ? totalSales / orderCount : 0;

      setStats({ totalSales, orderCount, avgPerOrder });

      // Fetch top 5 selling products from today's completed orders
      if (orderCount > 0) {
        const orderIds = orders!.map((o) => o.id);

        const { data: items, error: itemsError } = await supabase
          .from('order_items')
          .select('product_id, quantity, subtotal, products(name)')
          .in('order_id', orderIds);

        if (itemsError) throw itemsError;

        // Aggregate by product
        const productMap = new Map<string, TopProduct>();
        for (const item of items ?? []) {
          const productsRaw = item.products as unknown;
          const name =
            (productsRaw !== null && typeof productsRaw === 'object' && !Array.isArray(productsRaw)
              ? (productsRaw as { name: string }).name
              : Array.isArray(productsRaw) && productsRaw.length > 0
              ? (productsRaw[0] as { name: string }).name
              : null) ?? 'ไม่ทราบชื่อ';
          if (productMap.has(item.product_id)) {
            const existing = productMap.get(item.product_id)!;
            existing.total_qty += item.quantity;
            existing.total_revenue += item.subtotal;
          } else {
            productMap.set(item.product_id, {
              product_id: item.product_id,
              product_name: name,
              total_qty: item.quantity,
              total_revenue: item.subtotal,
            });
          }
        }

        const sorted = Array.from(productMap.values())
          .sort((a, b) => b.total_qty - a.total_qty)
          .slice(0, 5);

        setTopProducts(sorted);
      } else {
        setTopProducts([]);
      }
    } catch (err) {
      setFetchError('โหลดข้อมูลไม่สำเร็จ กรุณาดึงลงเพื่อลองใหม่');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [shop?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  // Guard: super_admin has no shop — show admin empty state
  if (!shop) {
    return (
      <View style={[styles.container, styles.centered, { gap: 12 }]}>
        <Ionicons name="shield-checkmark-outline" size={56} color={colors.primary} />
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text.primary }}>
          คุณเป็น System Admin
        </Text>
        <Text style={{ fontSize: 14, color: colors.text.secondary, textAlign: 'center', paddingHorizontal: 32 }}>
          ไปที่ ตั้งค่า เพื่ออนุมัติร้านค้าใหม่
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      {/* Date header */}
      <Text style={styles.dateLabel}>
        {new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </Text>

      {/* Fetch error banner */}
      {fetchError ? (
        <View style={styles.errorBanner}>
          <Ionicons name="cloud-offline-outline" size={20} color="#B45309" />
          <Text style={styles.errorBannerText}>{fetchError}</Text>
        </View>
      ) : null}

      {/* Hero gradient card */}
      <LinearGradient
        colors={colors.gradient.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroTopRow}>
          <View style={styles.heroBadge}>
            <Ionicons name="flash" size={12} color="rgba(255,255,255,0.9)" />
            <Text style={styles.heroBadgeText}>วันนี้</Text>
          </View>
          <Text style={styles.heroDateText}>
            {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', calendar: 'gregory' })}
          </Text>
        </View>
        <Text style={styles.heroLabel}>ยอดขายรวม</Text>
        <Text style={styles.heroAmount}>
          ฿{stats.totalSales.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
        </Text>
        <View style={styles.heroFooter}>
          <View style={styles.heroStat}>
            <Ionicons name="receipt-outline" size={14} color="rgba(255,255,255,0.7)" />
            <Text style={styles.heroStatText}>{stats.orderCount} ออเดอร์</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <Ionicons name="trending-up-outline" size={14} color="rgba(255,255,255,0.7)" />
            <Text style={styles.heroStatText}>
              เฉลี่ย ฿{stats.avgPerOrder.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Top products section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="trophy-outline" size={18} color={colors.warning} />
          <Text style={styles.sectionTitle}>สินค้าขายดี 5 อันดับ</Text>
        </View>

        {topProducts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="bar-chart-outline" size={48} color={colors.text.light} />
            <Text style={styles.emptyText}>ยังไม่มีข้อมูลยอดขายวันนี้</Text>
          </View>
        ) : (
          topProducts.map((item, index) => (
            <View key={item.product_id} style={styles.productRow}>
              {/* Rank badge */}
              <View style={[styles.rankBadge, index === 0 && styles.rankBadgeGold,
                index === 1 && styles.rankBadgeSilver, index === 2 && styles.rankBadgeBronze]}>
                <Text style={[styles.rankText, index < 3 && styles.rankTextLight]}>
                  {index + 1}
                </Text>
              </View>

              {/* Product name */}
              <Text style={styles.productName} numberOfLines={1}>
                {item.product_name}
              </Text>

              {/* Stats */}
              <View style={styles.productStats}>
                <Text style={styles.productQty}>{item.total_qty} ชิ้น</Text>
                <Text style={styles.productRevenue}>
                  ฿{item.total_revenue.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  dateLabel: {
    fontSize: 13,
    color: colors.text.light,
    marginBottom: 16,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  // Hero gradient card
  heroCard: {
    borderRadius: radius['2xl'],
    padding: 24,
    marginBottom: 16,
    ...shadow.lg,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  heroDateText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  heroLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  heroAmount: {
    fontSize: 42,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'] as any,
    marginBottom: 20,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  heroStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroStatText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
    fontVariant: ['tabular-nums'] as any,
  },
  heroStatDivider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginTop: 4,
    ...shadow.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.light,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: colors.warning + '50',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
  },
  errorBannerText: {
    fontSize: 13,
    color: '#B45309',
    flex: 1,
    fontWeight: '500',
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: 12,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeGold: {
    backgroundColor: '#F59E0B',
  },
  rankBadgeSilver: {
    backgroundColor: '#9CA3AF',
  },
  rankBadgeBronze: {
    backgroundColor: '#D97706',
  },
  rankText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  rankTextLight: {
    color: '#FFFFFF',
  },
  productName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  productStats: {
    alignItems: 'flex-end',
    gap: 2,
  },
  productQty: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  productRevenue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
});
