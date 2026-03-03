import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/store/authStore';
import { Colors } from '../../constants/colors';

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
  const shop = useAuthStore((s) => s.shop);
  const [stats, setStats] = useState<DashboardStats>({ totalSales: 0, orderCount: 0, avgPerOrder: 0 });
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!shop?.id) return;

    // Today's date range (local midnight → end of day)
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

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
      // Silently handle — display will show zeros
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

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
      }
    >
      {/* Date header */}
      <Text style={styles.dateLabel}>
        {new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </Text>

      {/* Stat cards row */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, styles.statCardPrimary]}>
          <Ionicons name="cash-outline" size={22} color={Colors.surface} style={styles.statIcon} />
          <Text style={styles.statLabelLight}>ยอดวันนี้</Text>
          <Text style={styles.statValueLarge}>฿{stats.totalSales.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, styles.statCardSmall]}>
          <Ionicons name="receipt-outline" size={20} color={Colors.primary} style={styles.statIcon} />
          <Text style={styles.statLabel}>จำนวนออเดอร์</Text>
          <Text style={styles.statValue}>{stats.orderCount}</Text>
        </View>
        <View style={[styles.statCard, styles.statCardSmall]}>
          <Ionicons name="trending-up-outline" size={20} color={Colors.secondary} style={styles.statIcon} />
          <Text style={styles.statLabel}>เฉลี่ย/ออเดอร์</Text>
          <Text style={[styles.statValue, { color: Colors.secondary }]}>
            ฿{stats.avgPerOrder.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </View>
      </View>

      {/* Top products section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="trophy-outline" size={18} color={Colors.warning} />
          <Text style={styles.sectionTitle}>สินค้าขายดี 5 อันดับ</Text>
        </View>

        {topProducts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="bar-chart-outline" size={48} color={Colors.text.light} />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
    color: Colors.text.secondary,
    marginBottom: 16,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  statCardPrimary: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  statCardSmall: {
    flex: 1,
  },
  statIcon: {
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontWeight: '500',
    marginBottom: 4,
  },
  statLabelLight: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  statValueLarge: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.surface,
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginTop: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
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
    color: Colors.text.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.text.light,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: 12,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.background,
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
    color: Colors.text.secondary,
  },
  rankTextLight: {
    color: '#FFFFFF',
  },
  productName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  productStats: {
    alignItems: 'flex-end',
    gap: 2,
  },
  productQty: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  productRevenue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
});
