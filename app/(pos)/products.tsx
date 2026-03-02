import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useProductStore } from '../../src/store/productStore';
import { useAuthStore } from '../../src/store/authStore';
import { Product } from '../../src/types';

export default function ProductsScreen() {
  const shop = useAuthStore((s) => s.shop);
  const products = useProductStore((s) => s.products);
  const categories = useProductStore((s) => s.categories);
  const fetchProducts = useProductStore((s) => s.fetchProducts);
  const fetchCategories = useProductStore((s) => s.fetchCategories);
  const isLoading = useProductStore((s) => s.isLoading);

  const [search, setSearch] = useState('');

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

  const renderProduct = ({ item }: { item: Product }) => (
    <View style={styles.productRow}>
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{item.name}</Text>
        {item.category_id ? (
          <Text style={styles.productCategory}>
            {categoryMap[item.category_id] || '—'}
          </Text>
        ) : null}
      </View>
      <Text style={styles.productPrice}>฿{item.price.toFixed(2)}</Text>
      <View
        style={[
          styles.stockBadge,
          item.stock === 0 && styles.stockBadgeOut,
          item.stock > 0 && item.stock <= 10 && styles.stockBadgeLow,
        ]}
      >
        <Text
          style={[
            styles.stockText,
            item.stock === 0 && styles.stockTextOut,
            item.stock > 0 && item.stock <= 10 && styles.stockTextLow,
          ]}
        >
          {item.stock === 0 ? 'หมด' : item.stock}
        </Text>
      </View>
    </View>
  );

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
});
