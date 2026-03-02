import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';

interface NumPadProps {
  total: number;
  cashReceived: string;
  onKeyPress: (key: string) => void;
  onBackspace: () => void;
  onClear: () => void;
}

export function NumPad({ total, cashReceived, onKeyPress, onBackspace, onClear }: NumPadProps) {
  const cashValue = parseFloat(cashReceived) || 0;
  const change = cashValue - total;

  const keys = [
    ['7', '8', '9'],
    ['4', '5', '6'],
    ['1', '2', '3'],
    ['.', '0', 'back'],
  ];

  return (
    <View style={styles.container}>
      <View style={styles.displaySection}>
        <View style={styles.displayRow}>
          <Text style={styles.displayLabel}>ยอดรวม / Total</Text>
          <Text style={styles.displayTotal}>฿{total.toFixed(2)}</Text>
        </View>
        <View style={styles.displayRow}>
          <Text style={styles.displayLabel}>รับเงิน / Cash</Text>
          <Text style={styles.displayCash}>฿{cashReceived || '0'}</Text>
        </View>
        <View style={[styles.displayRow, styles.changeRow]}>
          <Text style={styles.displayLabel}>เงินทอน / Change</Text>
          <Text style={[styles.displayChange, change >= 0 && styles.displayChangePositive]}>
            {change >= 0 ? `฿${change.toFixed(2)}` : '-'}
          </Text>
        </View>
      </View>

      <View style={styles.keypad}>
        {keys.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.keyRow}>
            {row.map((key) => (
              <TouchableOpacity
                key={key}
                style={[styles.key, key === 'back' && styles.keySpecial]}
                onPress={() => {
                  if (key === 'back') {
                    onBackspace();
                  } else {
                    onKeyPress(key);
                  }
                }}
                activeOpacity={0.6}
              >
                {key === 'back' ? (
                  <Ionicons name="backspace-outline" size={24} color={Colors.danger} />
                ) : (
                  <Text style={styles.keyText}>{key}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ))}

        <TouchableOpacity style={styles.clearButton} onPress={onClear} activeOpacity={0.7}>
          <Text style={styles.clearButtonText}>ล้าง / Clear</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  displaySection: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  displayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  changeRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 4,
    paddingTop: 10,
  },
  displayLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  displayTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  displayCash: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.primary,
  },
  displayChange: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.light,
  },
  displayChangePositive: {
    color: Colors.secondary,
  },
  keypad: {
    gap: 8,
  },
  keyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  key: {
    flex: 1,
    height: 56,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  keySpecial: {
    backgroundColor: Colors.danger + '10',
  },
  keyText: {
    fontSize: 22,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  clearButton: {
    height: 48,
    backgroundColor: Colors.text.light + '30',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  clearButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
});
