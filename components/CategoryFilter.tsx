import { ScrollView, TouchableOpacity, Text } from 'react-native';

interface Category {
  id: string;
  label: string;
  color?: string;
}

interface CategoryFilterProps {
  categories: Category[];
  selected: string;
  onSelect: (id: string) => void;
}

export function CategoryFilter({ categories, selected, onSelect }: CategoryFilterProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="flex-grow-0"
      contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
    >
      {categories.map((cat) => {
        const isActive = selected === cat.id;
        return (
          <TouchableOpacity
            key={cat.id}
            onPress={() => onSelect(cat.id)}
            activeOpacity={0.7}
            className={`px-5 py-2.5 rounded-full border ${
              isActive
                ? 'bg-primary border-primary'
                : 'bg-white border-emerald-200'
            }`}
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <Text
              className={`text-sm font-semibold ${
                isActive ? 'text-white' : 'text-teal-700'
              }`}
              style={{ includeFontPadding: false, lineHeight: 20 }}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
