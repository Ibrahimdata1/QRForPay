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
      <View style={styles.leftSection}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.unitPrice}>฿{price.toFixed(2)} / ชิ้น</Text>
      </View>

      <View style={styles.quantityControls}>
        <TouchableOpacity style={styles.qtyButton} onPress={onDecrement} activeOpacity={0.7}>
          <Ionicons name="remove" size={18} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.qtyText}>{quantity}</Text>
        <TouchableOpacity style={styles.qtyButton} onPress={onIncrement} activeOpacity={0.7}>
          <Ionicons name="add" size={18} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.subtotal}>฿{subtotal.toFixed(2)}</Text>

      <TouchableOpacity onPress={onRemove} style={styles.deleteButton} activeOpacity={0.7}>
        <Ionicons name="trash-outline" size={18} color={Colors.danger} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  leftSection: {
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  unitPrice: {
    fontSize: 12,
    color: Colors.text.light,
    marginTop: 2,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
    minWidth: 28,
    textAlign: 'center',
  },
  subtotal: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
    marginLeft: 12,
    minWidth: 65,
    textAlign: 'right',
  },
  deleteButton: {
    padding: 6,
    marginLeft: 8,
  },
});
