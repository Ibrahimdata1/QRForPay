import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

interface Category {
  id: string;
  label: string;
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
      contentContainerStyle={styles.container}
    >
      {categories.map((cat) => (
        <TouchableOpacity
          key={cat.id}
          style={[styles.pill, selected === cat.id && styles.pillActive]}
          onPress={() => onSelect(cat.id)}
          activeOpacity={0.7}
        >
          <Text style={[styles.pillText, selected === cat.id && styles.pillTextActive]}>
            {cat.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pillText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.secondary,
    lineHeight: 24,
    includeFontPadding: false,
  },
  pillTextActive: {
    color: Colors.surface,
  },
});
