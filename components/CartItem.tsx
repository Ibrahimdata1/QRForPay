import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
    <View
      className="flex-row items-center bg-white rounded-2xl p-3 mb-2"
      style={{
        borderWidth: 1,
        borderColor: '#D1FAE5',
        shadowColor: '#0F766E',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
      }}
    >
      <View className="flex-1 mr-2">
        <Text className="text-sm font-semibold text-teal-900" numberOfLines={1}>
          {name}
        </Text>
        <Text className="text-xs text-gray-400 mt-0.5">฿{price.toFixed(2)} / ชิ้น</Text>
      </View>

      <View className="flex-row items-center" style={{ gap: 4 }}>
        <TouchableOpacity
          style={styles.qtyButton}
          onPress={onDecrement}
          activeOpacity={0.7}
        >
          <Ionicons name="remove" size={18} color="#0F766E" />
        </TouchableOpacity>
        <Text className="text-base font-bold text-teal-900 text-center" style={{ minWidth: 28 }}>
          {quantity}
        </Text>
        <TouchableOpacity
          style={styles.qtyButton}
          onPress={onIncrement}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={18} color="#0F766E" />
        </TouchableOpacity>
      </View>

      <Text className="text-sm font-bold text-teal-900 ml-3 text-right" style={{ minWidth: 65 }}>
        ฿{subtotal.toFixed(2)}
      </Text>

      <TouchableOpacity onPress={onRemove} className="p-1.5 ml-2" activeOpacity={0.7}>
        <Ionicons name="trash-outline" size={18} color="#EF4444" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#0F766E18',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
