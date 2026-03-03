import { useEffect, useMemo, useState } from 'react';
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
import { Colors } from '../../constants/colors';
import { useProductStore } from '../../src/store/productStore';
import { useAuthStore } from '../../src/store/authStore';
import { Product } from '../../src/types';
import { ProductFormModal } from '../../components/ProductFormModal';

export default function ProductsScreen() {
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
  const [search, setSearch] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (shop?.id && products.length === 0) {
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
    if (stock === 0) return '#EF4444';
    if (stock <= 10) return '#F59E0B';
    return '#10B981';
  };

  const renderProduct = ({ item }: { item: Product }) => {
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
              <Ionicons name="cube-outline" size={20} color={Colors.primary} />
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
        <Text style={styles.productPrice}>฿{item.price.toFixed(0)}</Text>

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
          <Ionicons name="pencil-outline" size={16} color={Colors.primary} />
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
  };

  if (isLoading && products.length === 0) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.text.light} />
        <TextInput
          style={styles.searchInput}
          placeholder="ค้นหาสินค้า..."
          placeholderTextColor={Colors.text.light}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <Ionicons
            name="close-circle"
            size={20}
            color={Colors.text.light}
            onPress={() => setSearch('')}
          />
        ) : null}
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderProduct}
        contentContainerStyle={styles.listContent}
        onRefresh={() => shop?.id && fetchProducts(shop.id)}
        refreshing={isLoading}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={48} color={Colors.text.light} />
            <Text style={styles.emptyText}>ไม่พบสินค้า / No products found</Text>
          </View>
        }
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => { setEditingProduct(null); setFormVisible(true); }}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    margin: 16,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 15,
    color: Colors.text.primary,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  productCategory: {
    fontSize: 12,
    color: Colors.text.light,
    marginTop: 2,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
    marginRight: 12,
  },
  stockBadge: {
    backgroundColor: Colors.secondary + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 40,
    alignItems: 'center',
  },
  stockBadgeOut: {
    backgroundColor: Colors.danger + '20',
  },
  stockBadgeLow: {
    backgroundColor: Colors.warning + '20',
  },
  stockText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.secondary,
  },
  stockTextOut: {
    color: Colors.danger,
  },
  stockTextLow: {
    color: Colors.warning,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.text.light,
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
    backgroundColor: '#E6F5F3',
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
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
});
