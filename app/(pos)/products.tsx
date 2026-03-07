import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { shadow, radius } from '../../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useProductStore } from '../../src/store/productStore';
import { useAuthStore } from '../../src/store/authStore';
import { Product } from '../../src/types';
import { ProductFormModal } from '../../components/ProductFormModal';
import { useTheme, ThemeColors } from '../../constants/ThemeContext';

export default function ProductsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const shop = useAuthStore((s) => s.shop);
  const profile = useAuthStore((s) => s.profile);
  const isOwner = profile?.role === 'owner';
  const products = useProductStore((s) => s.products);
  const categories = useProductStore((s) => s.categories);
  const fetchProducts = useProductStore((s) => s.fetchProducts);
  const fetchCategories = useProductStore((s) => s.fetchCategories);
  const isLoading = useProductStore((s) => s.isLoading);

  const saveProduct = useProductStore((s) => s.saveProduct);
  const deleteProduct = useProductStore((s) => s.deleteProduct);
  const reorderProducts = useProductStore((s) => s.reorderProducts);
  const [search, setSearch] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);


  useEffect(() => {
    if (shop?.id) {
      fetchProducts(shop.id);
      fetchCategories(shop.id);
    }
  }, [shop?.id]);

  const categoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach((c) => { map[c.id] = c.name; });
    return map;
  }, [categories]);

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase().trim();
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, search]);

  const getStockColor = (stock: number) => {
    if (stock === 0) return '#EF4444';   // หมด — แดง
    if (stock <= 5) return '#F59E0B';    // ต่ำมาก — ส้ม
    if (stock <= 20) return '#3B82F6';   // ปานกลาง — น้ำเงิน
    return '#6B7280';                    // เยอะ — เทาเป็นกลาง
  };

  const renderProductContent = useCallback(({ item }: { item: Product }) => {
    const stockColor = getStockColor(item.stock);
    return (
      <View style={styles.productRow}>
        {/* Left accent bar */}
        <View style={[styles.accentBar, { backgroundColor: stockColor }]} />

        {/* Thumbnail */}
        <View style={styles.thumbnail}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.thumbnailImg} resizeMode="cover" />
          ) : (
            <View style={styles.thumbnailFallback}>
              <Ionicons name="cube-outline" size={20} color={colors.primary} />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
          {item.category_id ? (
            <Text style={styles.productCategory}>
              {categoryMap[item.category_id] || '—'}
            </Text>
          ) : null}
        </View>

        {/* Price */}
        <Text style={styles.productPrice}>฿{(item.price ?? 0).toFixed(0)}</Text>

        {/* Stock badge */}
        <View style={[styles.stockBadge, { backgroundColor: stockColor + '18', borderColor: stockColor + '40' }]}>
          <Text style={[styles.stockText, { color: stockColor }]}>
            {item.stock === 0 ? 'หมด' : item.stock}
          </Text>
        </View>

        {/* Edit */}
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => { setEditingProduct(item); setFormVisible(true); }}
        >
          <Ionicons name="pencil-outline" size={16} color={colors.primary} />
        </TouchableOpacity>

        {/* Delete — owner only */}
        {isOwner && (
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => {
              Alert.alert(
                'ลบสินค้า',
                `ต้องการลบ "${item.name}" ออกจากระบบ?`,
                [
                  { text: 'ยกเลิก', style: 'cancel' },
                  {
                    text: 'ลบ',
                    style: 'destructive',
                    onPress: () => deleteProduct(item.id),
                  },
                ]
              );
            }}
          >
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>
    );
  }, [isOwner, categoryMap, colors]);

  // Guard: super_admin has no shop — show admin empty state
  if (!shop) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', gap: 12 }]}>
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

  if (isLoading && products.length === 0) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={colors.text.light} />
        <TextInput
          style={styles.searchInput}
          placeholder="ค้นหาสินค้า..."
          placeholderTextColor={colors.text.light}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <Ionicons
            name="close-circle"
            size={20}
            color={colors.text.light}
            onPress={() => setSearch('')}
          />
        ) : null}
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderProductContent}
        contentContainerStyle={styles.listContent}
        onRefresh={() => { if (shop?.id) { fetchProducts(shop.id); fetchCategories(shop.id); } }}
        refreshing={isLoading}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={48} color={colors.text.light} />
            <Text style={styles.emptyText}>ยังไม่มีสินค้า</Text>
          </View>
        }
      />
      <TouchableOpacity
        style={styles.fabWrapper}
        onPress={() => { setEditingProduct(null); setFormVisible(true); }}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={colors.gradient.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fab}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>
      <ProductFormModal
        visible={formVisible}
        product={editingProduct}
        categories={categories}
        shopId={shop?.id ?? ''}
        onSave={(data) => saveProduct(shop?.id ?? '', data)}
        onClose={() => setFormVisible(false)}
      />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.borderLight,
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 15,
    color: colors.text.primary,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 8,
    ...shadow.sm,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  productCategory: {
    fontSize: 12,
    color: colors.text.light,
    marginTop: 2,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
    marginRight: 12,
    fontVariant: ['tabular-nums'] as any,
    letterSpacing: -0.3,
  },
  stockBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    minWidth: 44,
    alignItems: 'center',
  },
  stockBadgeOut: {
    backgroundColor: colors.danger + '20',
  },
  stockBadgeLow: {
    backgroundColor: colors.warning + '20',
  },
  stockText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.secondary,
  },
  stockTextOut: {
    color: colors.danger,
  },
  stockTextLow: {
    color: colors.warning,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 16,
    color: colors.text.light,
    marginTop: 12,
  },
  accentBar: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
    marginRight: 12,
  },
  thumbnail: {
    width: 44,
    height: 44,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
  },
  thumbnailImg: {
    width: '100%',
    height: '100%',
  },
  thumbnailFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBtn: {
    padding: 8,
    marginLeft: 8,
  },
  deleteBtn: {
    padding: 8,
    marginLeft: 4,
  },
  fabWrapper: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: radius.full,
    overflow: 'hidden',
    ...shadow.lg,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
