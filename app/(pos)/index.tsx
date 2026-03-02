import { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
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
  const filteredProducts = useProductStore(selectFilteredProducts);

  const addItem = useCartStore((s) => s.addItem);
  const cartCount = useCartStore(selectItemCount);

  useEffect(() => {
    if (shop?.id) {
      fetchProducts(shop.id);
      fetchCategories(shop.id);
    }
  }, [shop?.id]);

  const categoryOptions = useMemo(() => {
    const all = { id: 'all', label: 'ทั้งหมด / All' };
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
          placeholder="ค้นหาสินค้า / Search products..."
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
          <ProductCard product={item} onPress={(p) => addItem(p)} />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="search" size={48} color={Colors.text.light} />
            <Text style={styles.emptyText}>ไม่พบสินค้า / No products found</Text>
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
          <Text style={styles.cartButtonText}>ดูตะกร้า / View Cart</Text>
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>{cartCount}</Text>
          </View>
        </TouchableOpacity>
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
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 15,
    color: Colors.text.primary,
  },
  productGrid: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 100,
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
    fontSize: 16,
    color: Colors.text.light,
    marginTop: 12,
  },
  cartButton: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  cartButtonText: {
    color: Colors.surface,
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  cartBadge: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    paddingHorizontal: 6,
  },
  cartBadgeText: {
    color: Colors.surface,
    fontSize: 12,
    fontWeight: '700',
  },
});
