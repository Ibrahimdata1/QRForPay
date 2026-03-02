import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Product } from '../src/types';

interface ProductCardProps {
  product: Product;
  onPress: (product: Product) => void;
}

const { width } = Dimensions.get('window');
const NUM_COLUMNS = width > 600 ? 3 : 2;
const CARD_WIDTH = (width - 12 * 2 - 8 * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

export function ProductCard({ product, onPress }: ProductCardProps) {
  const isOutOfStock = product.stock === 0;

  return (
    <TouchableOpacity
      style={[styles.card, isOutOfStock && styles.cardDisabled]}
      onPress={() => !isOutOfStock && onPress(product)}
      activeOpacity={isOutOfStock ? 1 : 0.7}
    >
      <View style={styles.imagePlaceholder}>
        <Ionicons
          name="cube-outline"
          size={36}
          color={isOutOfStock ? Colors.text.light : Colors.primary}
        />
        {isOutOfStock && (
          <View style={styles.outOfStockOverlay}>
            <Text style={styles.outOfStockText}>หมดสต็อก</Text>
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {product.name}
        </Text>
        <View style={styles.bottomRow}>
          <Text style={styles.price}>฿{product.price.toFixed(0)}</Text>
          {product.stock > 0 && product.stock <= 10 ? (
            <Text style={styles.lowStock}>เหลือ {product.stock}</Text>
          ) : product.stock > 10 ? (
            <Text style={styles.inStock}>มีสินค้า</Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardDisabled: {
    opacity: 0.6,
  },
  imagePlaceholder: {
    width: '100%',
    height: CARD_WIDTH * 0.65,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outOfStockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  outOfStockText: {
    color: Colors.surface,
    fontSize: 14,
    fontWeight: '700',
  },
  info: {
    padding: 10,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  lowStock: {
    fontSize: 11,
    color: Colors.warning,
    fontWeight: '600',
  },
  inStock: {
    fontSize: 11,
    color: Colors.secondary,
    fontWeight: '500',
  },
});
