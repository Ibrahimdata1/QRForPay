import { TouchableOpacity, View, Text, Image } from 'react-native';
import type { Product } from '../src/types';

const FOOD_EMOJI: Record<string, string> = {
  'ข้าวผัดกระเพรา': '🍛',
  'ก๋วยเตี๋ยวต้มยำ': '🍜',
  'ข้าวมันไก่': '🍗',
  'ส้มตำไทย': '🥗',
  'ชาเย็น': '🧋',
  'กาแฟเย็น': '☕',
  'น้ำส้มคั้นสด': '🍊',
  'สบู่เหลว': '🧴',
  'แปรงสีฟัน': '🪥',
  'ผงซักฟอก': '🧺',
};

function getProductEmoji(name: string): string {
  return FOOD_EMOJI[name] ?? '🛍️';
}

interface ProductCardProps {
  product: Product;
  onPress: (product: Product) => void;
  width?: number;
}

export function ProductCard({ product, onPress, width }: ProductCardProps) {
  const isOutOfStock = product.stock === 0;
  const isLowStock = product.stock > 0 && product.stock <= 10;
  const emoji = getProductEmoji(product.name);

  return (
    <TouchableOpacity
      onPress={() => !isOutOfStock && onPress(product)}
      activeOpacity={0.85}
      style={{ width: width ?? '48%' }}
      className="mb-3"
    >
      <View
        className={`bg-white rounded-2xl overflow-hidden ${isOutOfStock ? 'opacity-60' : ''}`}
        style={{
          shadowColor: '#0F766E',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 12,
          elevation: 6,
        }}
      >
        {/* Image / Emoji Area */}
        <View className="items-center justify-center bg-emerald-50 relative" style={{ height: 120 }}>
          {product.image_url ? (
            <Image
              source={{ uri: product.image_url }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <Text style={{ fontSize: 56 }}>{emoji}</Text>
          )}
          {/* Out of stock overlay */}
          {isOutOfStock && (
            <View className="absolute inset-0 bg-black/40 items-center justify-center">
              <View className="bg-red-500 px-2 py-1 rounded-lg">
                <Text className="text-white text-xs font-bold">หมดสต็อก</Text>
              </View>
            </View>
          )}
          {/* Low stock badge */}
          {isLowStock && !isOutOfStock && (
            <View className="absolute top-2 right-2 bg-amber-400 px-2 py-0.5 rounded-full">
              <Text className="text-white text-xs font-bold">เหลือ {product.stock}</Text>
            </View>
          )}
          {/* In stock badge */}
          {!isOutOfStock && !isLowStock && (
            <View className="absolute top-2 right-2 bg-emerald-500 px-2 py-0.5 rounded-full">
              <Text className="text-white text-xs font-bold">มีสินค้า</Text>
            </View>
          )}
        </View>

        {/* Info Area */}
        <View className="px-3 py-2.5">
          <Text className="text-sm font-semibold text-teal-900 mb-1" numberOfLines={1}>
            {product.name}
          </Text>
          <Text className="text-base font-bold" style={{ color: '#0F766E' }}>
            ฿{product.price.toFixed(0)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
