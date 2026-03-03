import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { ProductCard } from '../../components/ProductCard';
import { CategoryFilter } from '../../components/CategoryFilter';
import { useCartStore, selectItemCount } from '../../src/store/cartStore';
import { useProductStore, selectFilteredProducts } from '../../src/store/productStore';
import { useAuthStore } from '../../src/store/authStore';

const { width } = Dimensions.get('window');
const NUM_COLUMNS = width > 600 ? 3 : 2;

export default function POSScreen() {
  const shop = useAuthStore((s) => s.shop);

  const fetchProducts = useProductStore((s) => s.fetchProducts);
  const fetchCategories = useProductStore((s) => s.fetchCategories);
  const categories = useProductStore((s) => s.categories);
  const selectedCategoryId = useProductStore((s) => s.selectedCategoryId);
  const searchQuery = useProductStore((s) => s.searchQuery);
  const setSearch = useProductStore((s) => s.setSearch);
  const setCategory = useProductStore((s) => s.setCategory);
  const isLoading = useProductStore((s) => s.isLoading);
  const filteredProducts = useProductStore(useShallow(selectFilteredProducts));

  const addItem = useCartStore((s) => s.addItem);
  const cartCount = useCartStore(selectItemCount);

  // Toast state
  const [toastProduct, setToastProduct] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (name: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastProduct(name);
    toastOpacity.setValue(0);
    Animated.timing(toastOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      toastTimer.current = setTimeout(() => {
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setToastProduct(null));
      }, 1500);
    });
  };

  useEffect(() => {
    if (shop?.id) {
      fetchProducts(shop.id);
      fetchCategories(shop.id);
    }
  }, [shop?.id]);

  const categoryOptions = useMemo(() => {
    const all = { id: 'all', label: 'ทั้งหมด' };
    return [all, ...categories.map((c) => ({ id: c.id, label: c.name }))];
  }, [categories]);

  const handleCategorySelect = (id: string) => {
    setCategory(id === 'all' ? null : id);
  };

  if (isLoading && filteredProducts.length === 0) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.text.light} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="ค้นหาสินค้า..."
          placeholderTextColor={Colors.text.light}
          value={searchQuery}
          onChangeText={setSearch}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={20} color={Colors.text.light} />
          </TouchableOpacity>
        ) : null}
      </View>

      <CategoryFilter
        categories={categoryOptions}
        selected={selectedCategoryId || 'all'}
        onSelect={handleCategorySelect}
      />

      <FlatList
        data={filteredProducts}
        numColumns={NUM_COLUMNS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.productGrid}
        columnWrapperStyle={styles.columnWrapper}
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            onPress={(p) => {
              addItem(p);
              showToast(p.name);
            }}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="search" size={48} color={Colors.text.light} />
            <Text style={styles.emptyText}>ไม่พบสินค้า</Text>
            {selectedCategoryId ? (
              <TouchableOpacity onPress={() => setCategory(null)} activeOpacity={0.7}>
                <Text style={styles.emptyHintLink}>ลองกด &quot;ทั้งหมด&quot; เพื่อดูสินค้าทั้งหมด</Text>
              </TouchableOpacity>
            ) : searchQuery ? (
              <Text style={styles.emptyHint}>ลองค้นหาด้วยคำอื่น</Text>
            ) : null}
          </View>
        }
      />

      {cartCount > 0 && (
        <TouchableOpacity
          style={styles.cartButton}
          onPress={() => router.push('/(pos)/cart')}
          activeOpacity={0.85}
        >
          <Ionicons name="cart" size={24} color={Colors.surface} />
          <Text style={styles.cartButtonText}>ตะกร้า</Text>
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>{cartCount}</Text>
          </View>
        </TouchableOpacity>
      )}

      {toastProduct !== null && (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]} pointerEvents="none">
          <Text style={styles.toastText}>✓ เพิ่ม {toastProduct} แล้ว</Text>
        </Animated.View>
      )}
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
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 15,
    color: Colors.text.primary,
  },
  productGrid: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 110,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.text.light,
    marginTop: 12,
  },
  emptyHint: {
    fontSize: 13,
    color: Colors.text.light,
    marginTop: 6,
    opacity: 0.75,
  },
  emptyHintLink: {
    fontSize: 13,
    color: Colors.primary,
    marginTop: 6,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  toast: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: Colors.success,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cartButton: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  cartButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 10,
  },
  cartBadge: {
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    minWidth: 26,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    paddingHorizontal: 6,
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
