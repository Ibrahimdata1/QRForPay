import { View, ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';

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
      contentContainerStyle={styles.scrollContent}
    >
      {categories.map((cat) => {
        const isActive = selected === cat.id;
        return (
          <TouchableOpacity
            key={cat.id}
            onPress={() => onSelect(cat.id)}
            activeOpacity={0.7}
            style={[styles.chip, isActive && styles.chipActive]}
          >
            {isActive && <View style={styles.activeDot} />}
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E8ECF0',
    minHeight: 38,
    justifyContent: 'center',
    gap: 5,
  },
  chipActive: {
    backgroundColor: '#0F766E',
    borderColor: '#0F766E',
    borderWidth: 0,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.70)',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
});
