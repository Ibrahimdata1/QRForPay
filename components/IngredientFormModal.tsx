import { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ingredient } from '../src/types';
import { Colors } from '../constants/colors';

interface IngredientFormModalProps {
  visible: boolean;
  ingredient: Ingredient | null;
  shopId: string;
  onSave: (shopId: string, data: Partial<Ingredient>) => Promise<void>;
  onClose: () => void;
}

export function IngredientFormModal({
  visible,
  ingredient,
  shopId,
  onSave,
  onClose,
}: IngredientFormModalProps) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [currentStock, setCurrentStock] = useState('');
  const [minThreshold, setMinThreshold] = useState('');
  const [costPerUnit, setCostPerUnit] = useState('');
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(ingredient?.name ?? '');
      setUnit(ingredient?.unit ?? '');
      setCurrentStock(ingredient ? String(ingredient.current_stock) : '0');
      setMinThreshold(ingredient ? String(ingredient.min_threshold) : '0');
      setCostPerUnit(ingredient ? String(ingredient.cost_per_unit) : '0');
      setExpiryDate(ingredient?.expiry_date ? new Date(ingredient.expiry_date) : null);
    }
  }, [visible, ingredient]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('กรุณากรอกชื่อวัตถุดิบ');
      return;
    }
    if (!unit.trim()) {
      Alert.alert('กรุณากรอกหน่วย');
      return;
    }
    const stockNum = parseFloat(currentStock);
    if (isNaN(stockNum) || stockNum < 0) {
      Alert.alert('กรุณากรอกจำนวนสต็อกที่ถูกต้อง');
      return;
    }
    const thresholdNum = parseFloat(minThreshold);
    if (isNaN(thresholdNum) || thresholdNum < 0) {
      Alert.alert('กรุณากรอกจำนวนขั้นต่ำที่ถูกต้อง');
      return;
    }
    const costNum = parseFloat(costPerUnit);
    if (isNaN(costNum) || costNum < 0) {
      Alert.alert('กรุณากรอกต้นทุนที่ถูกต้อง');
      return;
    }

    setSaving(true);
    try {
      await onSave(shopId, {
        ...(ingredient?.id ? { id: ingredient.id } : {}),
        name: name.trim(),
        unit: unit.trim(),
        current_stock: stockNum,
        min_threshold: thresholdNum,
        cost_per_unit: costNum,
        expiry_date: expiryDate ? expiryDate.toISOString().split('T')[0] : null,
      });
      onClose();
    } catch (e: any) {
      Alert.alert('เกิดข้อผิดพลาด', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {ingredient ? 'แก้ไขวัตถุดิบ' : 'เพิ่มวัตถุดิบใหม่'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Name */}
            <Text style={styles.label}>ชื่อวัตถุดิบ *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="เช่น แป้งสาลี"
              placeholderTextColor={Colors.text.light}
            />

            {/* Unit */}
            <Text style={styles.label}>หน่วย *</Text>
            <TextInput
              style={styles.input}
              value={unit}
              onChangeText={setUnit}
              placeholder="เช่น kg, g, L, ml, pcs"
              placeholderTextColor={Colors.text.light}
            />

            {/* Stock + Threshold row */}
            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={styles.label}>สต็อกปัจจุบัน *</Text>
                <TextInput
                  style={styles.input}
                  value={currentStock}
                  onChangeText={setCurrentStock}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={Colors.text.light}
                />
              </View>
              <View style={styles.halfField}>
                <Text style={styles.label}>แจ้งเตือนเมื่อต่ำกว่า</Text>
                <TextInput
                  style={styles.input}
                  value={minThreshold}
                  onChangeText={setMinThreshold}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={Colors.text.light}
                />
              </View>
            </View>

            {/* Cost per unit */}
            <Text style={styles.label}>ต้นทุน / หน่วย (฿)</Text>
            <TextInput
              style={styles.input}
              value={costPerUnit}
              onChangeText={setCostPerUnit}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={Colors.text.light}
            />

            {/* Expiry date */}
            <Text style={styles.label}>วันหมดอายุ (ไม่บังคับ)</Text>
            <TouchableOpacity
              style={styles.dateRow}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={20} color={Colors.primary} style={styles.dateIcon} />
              <Text style={[styles.dateText, !expiryDate && styles.datePlaceholder]}>
                {expiryDate
                  ? `${String(expiryDate.getDate()).padStart(2, '0')}/${String(expiryDate.getMonth() + 1).padStart(2, '0')}/${expiryDate.getFullYear()}`
                  : 'ไม่ได้ระบุ'}
              </Text>
              {expiryDate && (
                <TouchableOpacity
                  onPress={() => setExpiryDate(null)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={20} color={Colors.text.light} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={expiryDate ?? new Date()}
                mode="date"
                display="default"
                minimumDate={new Date()}
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (event.type === 'set' && selectedDate) {
                    setExpiryDate(selectedDate);
                  }
                }}
              />
            )}

            <View style={{ height: 16 }} />
          </ScrollView>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={saving}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelBtnText}>ยกเลิก</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color={Colors.text.inverse} />
              ) : (
                <Text style={styles.saveBtnText}>
                  {ingredient ? 'บันทึกการแก้ไข' : 'เพิ่มวัตถุดิบ'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 15,
    color: Colors.text.primary,
    backgroundColor: Colors.background,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
    backgroundColor: Colors.background,
  },
  dateIcon: {
    marginRight: 10,
  },
  dateText: {
    flex: 1,
    fontSize: 15,
    color: Colors.text.primary,
  },
  datePlaceholder: {
    color: Colors.text.light,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfField: {
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  saveBtn: {
    flex: 2,
    height: 52,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.inverse,
  },
});
