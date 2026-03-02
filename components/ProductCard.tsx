import { TouchableOpacity, View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Product } from '../src/types';
import { Colors } from '../constants/colors';

const AVATAR_COLORS = ['#FF8A80', '#80DEEA', '#FFD54F', '#80CBC4', '#CE93D8'];

function getAvatarColor(name: string): string {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

interface ProductCardProps {
  product: Product;
  onPress: (product: Product) => void;
  width?: number;
}

export function ProductCard({ product, onPress, width }: ProductCardProps) {
  const isOutOfStock = product.stock === 0;
  const isLowStock = product.stock > 0 && product.stock <= 10;
  const avatarColor = getAvatarColor(product.name);
  const avatarLetter = product.name.charAt(0).toUpperCase();

  return (
    <TouchableOpacity
      onPress={() => !isOutOfStock && onPress(product)}
      activeOpacity={0.85}
      style={[styles.wrapper, { width: width ?? '48%' }]}
    >
      <View style={[styles.card, isOutOfStock && styles.cardDisabled]}>
        {/* Image Area */}
        <View style={styles.imageArea}>
          {product.image_url ? (
            <Image
              source={{ uri: product.image_url }}
              style={styles.image}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.avatarBg, { backgroundColor: avatarColor }]}>
              <Text style={styles.avatarLetter}>{avatarLetter}</Text>
            </View>
          )}

          {/* Out of stock overlay */}
          {isOutOfStock && (
            <View style={styles.outOverlay}>
              <View style={styles.outBadge}>
                <Text style={styles.outBadgeText}>หมดสต็อก</Text>
              </View>
            </View>
          )}

          {/* Low stock badge — top right */}
          {isLowStock && !isOutOfStock && (
            <View style={styles.lowStockBadge}>
              <Text style={styles.lowStockText}>เหลือ {product.stock}</Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{product.name}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>฿{product.price.toFixed(0)}</Text>
            {!isOutOfStock && (
              <View style={styles.addBtn}>
                <Ionicons name="add" size={16} color="#FFFFFF" />
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 4,
  },
  cardDisabled: {
    opacity: 0.55,
  },
  imageArea: {
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  avatarBg: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  outOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  outBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  lowStockBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
  },
  lowStockText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  info: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  price: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.primary,
  },
  addBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
