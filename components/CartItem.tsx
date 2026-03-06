import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { shadow, radius } from '../constants/theme';
import { useTheme, ThemeColors } from '../constants/ThemeContext';

interface CartItemProps {
  name: string;
  price: number;
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
}

export function CartItem({
  name,
  price,
  quantity,
  onIncrement,
  onDecrement,
  onRemove,
}: CartItemProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const subtotal = price * quantity;

  return (
    <View style={styles.container}>
      {/* Left: name + unit price */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        <Text style={styles.unitPrice}>฿{price.toFixed(0)} / ชิ้น</Text>
      </View>

      {/* Qty controls — pill container */}
      <View style={styles.qtyPill}>
        <TouchableOpacity style={styles.qtyBtn} onPress={onDecrement} activeOpacity={0.7}>
          <Ionicons name="remove" size={14} color={colors.text.secondary} />
        </TouchableOpacity>
        <Text style={styles.qty}>{quantity}</Text>
        <TouchableOpacity style={styles.qtyBtn} onPress={onIncrement} activeOpacity={0.7}>
          <Ionicons name="add" size={14} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Subtotal */}
      <Text style={styles.total}>฿{subtotal.toFixed(0)}</Text>

      {/* Delete */}
      <TouchableOpacity onPress={onRemove} style={styles.deleteBtn} activeOpacity={0.7}>
        <Ionicons name="trash-outline" size={17} color={colors.danger} />
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 8,
    ...shadow.sm,
  },
  info: {
    flex: 1,
    marginRight: 10,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 3,
    lineHeight: 20,
  },
  unitPrice: {
    fontSize: 12,
    color: colors.text.light,
  },
  // Pill container wrapping minus - number - plus
  qtyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.borderLight,
    borderRadius: radius.full,
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 2,
  },
  qtyBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow.sm,
  },
  qty: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
    minWidth: 24,
    textAlign: 'center',
  },
  total: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
    minWidth: 60,
    textAlign: 'right',
    marginLeft: 10,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'] as any,
  },
  deleteBtn: {
    padding: 6,
    marginLeft: 4,
  },
});
