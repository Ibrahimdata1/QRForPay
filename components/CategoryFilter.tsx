import { View, ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

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
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={true}
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
      {/* Fade overlay — visual hint that list is scrollable */}
      <LinearGradient
        colors={['rgba(244,246,248,0)', 'rgba(244,246,248,0.95)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.fadeRight}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
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
  fadeRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 48,
  },
});
