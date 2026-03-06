import { useMemo, useRef } from 'react';
import { TouchableOpacity, View, Text, Image, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { Product } from '../src/types';
import { shadow, radius } from '../constants/theme';
import { useTheme, ThemeColors } from '../constants/ThemeContext';

interface ProductCardProps {
  product: Product;
  onPress: (product: Product) => void;
  width?: number;
}

export function ProductCard({ product, onPress, width }: ProductCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const isOutOfStock = product.stock === 0;
  const isLowStock = product.stock > 0 && product.stock <= 10;

  // Pick avatar gradient based on first character of name
  const avatarGradient = colors.gradient.avatar[
    product.name.charCodeAt(0) % colors.gradient.avatar.length
  ];
  const avatarLetter = product.name.charAt(0).toUpperCase();

  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    if (isOutOfStock) return;
    // Scale down then snap back — gives clear tactile-like feedback
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.93,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    onPress(product);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.85}
      style={[styles.wrapper, { width: width ?? '48%' }]}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
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
              <LinearGradient
                colors={avatarGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatarBg}
              >
                <Text style={styles.avatarLetter}>{avatarLetter}</Text>
              </LinearGradient>
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
      </Animated.View>
    </TouchableOpacity>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  wrapper: {
    marginBottom: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.md,
  },
  cardDisabled: {
    opacity: 0.45,
  },
  imageArea: {
    height: 118,
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
    fontSize: 38,
    fontWeight: '700',
    color: '#FFFFFF',
    opacity: 0.9,
  },
  outOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outBadge: {
    backgroundColor: colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  outBadgeText: {
    color: colors.text.inverse,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  lowStockBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.warning,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  lowStockText: {
    color: colors.text.inverse,
    fontSize: 11,
    fontWeight: '700',
  },
  info: {
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 13,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 7,
    lineHeight: 20,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  price: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'] as any,
  },
  addBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
});
