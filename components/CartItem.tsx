import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';

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
  const subtotal = price * quantity;

  return (
    <View style={styles.container}>
      {/* Left: name + unit price */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        <Text style={styles.unitPrice}>฿{price.toFixed(0)} / ชิ้น</Text>
      </View>

      {/* Qty controls */}
      <View style={styles.qtyRow}>
        <TouchableOpacity style={styles.qtyBtn} onPress={onDecrement} activeOpacity={0.7}>
          <Ionicons name="remove" size={15} color={Colors.text.secondary} />
        </TouchableOpacity>
        <Text style={styles.qty}>{quantity}</Text>
        <TouchableOpacity style={styles.qtyBtn} onPress={onIncrement} activeOpacity={0.7}>
          <Ionicons name="add" size={15} color={Colors.text.secondary} />
        </TouchableOpacity>
      </View>

      {/* Subtotal */}
      <Text style={styles.total}>฿{subtotal.toFixed(0)}</Text>

      {/* Delete */}
      <TouchableOpacity onPress={onRemove} style={styles.deleteBtn} activeOpacity={0.7}>
        <Ionicons name="trash-outline" size={17} color={Colors.danger} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  info: {
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  unitPrice: {
    fontSize: 12,
    color: Colors.text.light,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qtyBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  qty: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
    minWidth: 22,
    textAlign: 'center',
  },
  total: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
    minWidth: 62,
    textAlign: 'right',
    marginLeft: 10,
  },
  deleteBtn: {
    padding: 6,
    marginLeft: 6,
  },
});
