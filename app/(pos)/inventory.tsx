import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useIngredientStore } from '../../src/store/ingredientStore';
import { useAuthStore } from '../../src/store/authStore';
import { Ingredient, StockTransaction } from '../../src/types';
import { IngredientFormModal } from '../../components/IngredientFormModal';
import { supabase } from '../../src/lib/supabase';

type TabKey = 'ingredients' | 'stock_in' | 'history';

const ADJUST_TYPES = [
  { key: 'stock_in', label: 'รับของเข้า' },
  { key: 'adjustment', label: 'ปรับ' },
  { key: 'waste', label: 'ตัดทิ้ง' },
] as const;

type AdjustType = 'stock_in' | 'adjustment' | 'waste';

const TX_TYPE_LABELS: Record<StockTransaction['transaction_type'], string> = {
  stock_in: 'รับของเข้า',
  adjustment: 'ปรับ',
  waste: 'ตัดทิ้ง',
  auto_deduct: 'ตัดอัตโนมัติ',
};

const TX_TYPE_COLORS: Record<StockTransaction['transaction_type'], string> = {
  stock_in: Colors.success,
  adjustment: Colors.warning,
  waste: Colors.danger,
  auto_deduct: Colors.primary,
};

function getStockColor(ingredient: Ingredient): string {
  if (ingredient.current_stock <= ingredient.min_threshold) return Colors.danger;
  if (ingredient.current_stock <= ingredient.min_threshold * 1.2) return Colors.warning;
  return Colors.success;
}

function isExpiringSoon(expiryDate?: string | null): boolean {
  if (!expiryDate) return false;
  const expiry = new Date(expiryDate);
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= 7;
}

export default function InventoryScreen() {
  const shop = useAuthStore((s) => s.shop);
  const profile = useAuthStore((s) => s.profile);
  const ingredients = useIngredientStore((s) => s.ingredients);
  const isLoading = useIngredientStore((s) => s.isLoading);
  const fetchIngredients = useIngredientStore((s) => s.fetchIngredients);
  const saveIngredient = useIngredientStore((s) => s.saveIngredient);
  const deleteIngredient = useIngredientStore((s) => s.deleteIngredient);
  const adjustStock = useIngredientStore((s) => s.adjustStock);

  const [activeTab, setActiveTab] = useState<TabKey>('ingredients');
  const [formVisible, setFormVisible] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);

  // Stock-in form state
  const [selectedIngredientId, setSelectedIngredientId] = useState<string>('');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustType, setAdjustType] = useState<AdjustType>('stock_in');
  const [adjustNote, setAdjustNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ingredientSearch, setIngredientSearch] = useState('');

  // History state
  const [transactions, setTransactions] = useState<
    Array<StockTransaction & { ingredient_name?: string }>
  >([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    if (shop?.id) {
      fetchIngredients(shop.id);
    }
  }, [shop?.id]);

  const loadHistory = useCallback(async () => {
    if (!shop?.id) return;
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('stock_transactions')
        .select('*, ingredient:ingredients(name)')
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setTransactions(
        (data ?? []).map((row: any) => ({
          ...row,
          ingredient_name: row.ingredient?.name ?? '—',
        }))
      );
    } catch (err: any) {
      Alert.alert('เกิดข้อผิดพลาด', err.message);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [shop?.id]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

  const handleAdjustSubmit = async () => {
    if (!selectedIngredientId) {
      Alert.alert('กรุณาเลือกวัตถุดิบ');
      return;
    }
    const qty = parseFloat(adjustQty);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('กรุณากรอกจำนวนที่ถูกต้อง (มากกว่า 0)');
      return;
    }

    setIsSubmitting(true);
    try {
      // For waste/adjustment, pass negative delta so stock decreases
      const signedQty = adjustType === 'stock_in' ? qty : -qty;
      await adjustStock(
        shop?.id ?? '',
        selectedIngredientId,
        signedQty,
        adjustType,
        adjustNote.trim() || undefined,
        profile?.id ?? undefined
      );
      Alert.alert('สำเร็จ', 'บันทึกการเคลื่อนไหวสต็อกแล้ว');
      setAdjustQty('');
      setAdjustNote('');
      setSelectedIngredientId('');
      setIngredientSearch('');
    } catch (err: any) {
      Alert.alert('เกิดข้อผิดพลาด', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteIngredient = (item: Ingredient) => {
    Alert.alert(
      'ลบวัตถุดิบ',
      `ต้องการลบ "${item.name}" ออกจากระบบ?`,
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ลบ',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteIngredient(item.id);
            } catch (err: any) {
              Alert.alert('เกิดข้อผิดพลาด', err.message);
            }
          },
        },
      ]
    );
  };

  // ----------------------------------------------------------------
  // Tab 1 — วัตถุดิบ
  // ----------------------------------------------------------------
  const renderIngredient = ({ item }: { item: Ingredient }) => {
    const stockColor = getStockColor(item);
    const expiringSoon = isExpiringSoon(item.expiry_date);

    return (
      <TouchableOpacity
        style={styles.ingredientRow}
        onPress={() => {
          setEditingIngredient(item);
          setFormVisible(true);
        }}
        activeOpacity={0.75}
      >
        {/* Left accent bar colored by stock level */}
        <View style={[styles.accentBar, { backgroundColor: stockColor }]} />

        <View style={styles.ingredientInfo}>
          <Text style={styles.ingredientName} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.ingredientMeta}>
            <Text style={styles.ingredientUnit}>{item.unit}</Text>
            {item.cost_per_unit > 0 && (
              <Text style={styles.ingredientCost}>
                ฿{item.cost_per_unit.toFixed(2)} / {item.unit}
              </Text>
            )}
          </View>
          {item.expiry_date ? (
            <Text style={[styles.expiryText, expiringSoon && styles.expiryTextAlert]}>
              หมดอายุ: {item.expiry_date}
              {expiringSoon ? ' (ใกล้หมดอายุ)' : ''}
            </Text>
          ) : null}
        </View>

        {/* Stock badge */}
        <View
          style={[
            styles.stockBadge,
            { backgroundColor: stockColor + '18', borderColor: stockColor + '40' },
          ]}
        >
          <Text style={[styles.stockValue, { color: stockColor }]}>
            {item.current_stock % 1 === 0
              ? item.current_stock.toFixed(0)
              : item.current_stock.toFixed(2)}
          </Text>
          <Text style={[styles.stockUnit, { color: stockColor }]}>{item.unit}</Text>
        </View>

        {/* Delete button */}
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDeleteIngredient(item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="trash-outline" size={16} color={Colors.danger} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const ingredientsTab = (
    <View style={styles.tabContent}>
      {isLoading && ingredients.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={ingredients}
          keyExtractor={(item) => item.id}
          renderItem={renderIngredient}
          contentContainerStyle={styles.listContent}
          onRefresh={() => shop?.id && fetchIngredients(shop.id)}
          refreshing={isLoading}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="flask-outline" size={48} color={Colors.text.light} />
              <Text style={styles.emptyText}>ยังไม่มีวัตถุดิบ</Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          setEditingIngredient(null);
          setFormVisible(true);
        }}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color={Colors.text.inverse} />
      </TouchableOpacity>
    </View>
  );

  // ----------------------------------------------------------------
  // Tab 2 — เติมสต็อก
  // ----------------------------------------------------------------
  const selectedIngredient = ingredients.find((i) => i.id === selectedIngredientId);

  const stockInTab = (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.formContainer}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.sectionTitle}>บันทึกการเคลื่อนไหวสต็อก</Text>

      {/* Ingredient picker */}
      <Text style={styles.fieldLabel}>วัตถุดิบ *</Text>
      <TextInput
        style={{
          borderWidth: 1, borderColor: Colors.border, borderRadius: 8,
          padding: 8, marginBottom: 8, fontSize: 14, color: Colors.text.primary,
          backgroundColor: Colors.background,
        }}
        placeholder="ค้นหาวัตถุดิบ..."
        placeholderTextColor={Colors.text.light}
        value={ingredientSearch}
        onChangeText={setIngredientSearch}
      />
      <View style={styles.pickerList}>
        {ingredients.length === 0 ? (
          <Text style={styles.pickerEmpty}>ยังไม่มีวัตถุดิบ กรุณาเพิ่มก่อน</Text>
        ) : (
          ingredients
            .filter((i) => i.name.toLowerCase().includes(ingredientSearch.toLowerCase()))
            .map((ing) => (
            <TouchableOpacity
              key={ing.id}
              style={[
                styles.pickerItem,
                selectedIngredientId === ing.id && styles.pickerItemActive,
              ]}
              onPress={() => setSelectedIngredientId(ing.id)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.pickerItemName,
                  selectedIngredientId === ing.id && styles.pickerItemNameActive,
                ]}
              >
                {ing.name}
              </Text>
              <Text
                style={[
                  styles.pickerItemStock,
                  selectedIngredientId === ing.id && styles.pickerItemStockActive,
                ]}
              >
                คงเหลือ:{' '}
                {ing.current_stock % 1 === 0
                  ? ing.current_stock.toFixed(0)
                  : ing.current_stock.toFixed(2)}{' '}
                {ing.unit}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Type selector */}
      <Text style={styles.fieldLabel}>ประเภท *</Text>
      <View style={styles.typeRow}>
        {ADJUST_TYPES.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.typePill, adjustType === t.key && styles.typePillActive]}
            onPress={() => setAdjustType(t.key)}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.typePillText,
                adjustType === t.key && styles.typePillTextActive,
              ]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Quantity */}
      <Text style={styles.fieldLabel}>จำนวน{selectedIngredient ? ` (${selectedIngredient.unit})` : ''} *</Text>
      <TextInput
        style={styles.input}
        value={adjustQty}
        onChangeText={setAdjustQty}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={Colors.text.light}
      />

      {/* Note */}
      <Text style={styles.fieldLabel}>หมายเหตุ (ไม่บังคับ)</Text>
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        value={adjustNote}
        onChangeText={setAdjustNote}
        placeholder="เหตุผลหรือรายละเอียดเพิ่มเติม"
        placeholderTextColor={Colors.text.light}
        multiline
        numberOfLines={3}
      />

      <TouchableOpacity
        style={[styles.submitBtn, isSubmitting && { opacity: 0.6 }]}
        onPress={handleAdjustSubmit}
        disabled={isSubmitting}
        activeOpacity={0.85}
      >
        {isSubmitting ? (
          <ActivityIndicator color={Colors.text.inverse} />
        ) : (
          <Text style={styles.submitBtnText}>บันทึก</Text>
        )}
      </TouchableOpacity>

      <View style={{ height: 32 }} />
    </ScrollView>
  );

  // ----------------------------------------------------------------
  // Tab 3 — ประวัติ
  // ----------------------------------------------------------------
  const renderTransaction = ({
    item,
  }: {
    item: StockTransaction & { ingredient_name?: string };
  }) => {
    const typeColor = TX_TYPE_COLORS[item.transaction_type];
    const typeLabel = TX_TYPE_LABELS[item.transaction_type];
    const isPositive = item.quantity > 0;
    const qtyDisplay = `${isPositive ? '+' : ''}${
      item.quantity % 1 === 0
        ? item.quantity.toFixed(0)
        : item.quantity.toFixed(2)
    }`;

    const date = new Date(item.created_at);
    const dateStr = date.toLocaleDateString('th-TH', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
    });
    const timeStr = date.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <View style={styles.txRow}>
        <View style={[styles.txAccent, { backgroundColor: typeColor }]} />
        <View style={styles.txInfo}>
          <Text style={styles.txIngredientName} numberOfLines={1}>
            {item.ingredient_name}
          </Text>
          {item.note ? (
            <Text style={styles.txNote} numberOfLines={1}>
              {item.note}
            </Text>
          ) : null}
          <Text style={styles.txDate}>
            {dateStr} {timeStr}
          </Text>
        </View>
        <View
          style={[styles.txTypeBadge, { backgroundColor: typeColor + '18', borderColor: typeColor + '40' }]}
        >
          <Text style={[styles.txTypeBadgeText, { color: typeColor }]}>{typeLabel}</Text>
        </View>
        <Text style={[styles.txQty, { color: isPositive ? Colors.success : Colors.danger }]}>
          {qtyDisplay}
        </Text>
      </View>
    );
  };

  const historyTab = (
    <View style={styles.tabContent}>
      {isLoadingHistory ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          renderItem={renderTransaction}
          contentContainerStyle={styles.listContent}
          onRefresh={loadHistory}
          refreshing={isLoadingHistory}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="time-outline" size={48} color={Colors.text.light} />
              <Text style={styles.emptyText}>ยังไม่มีประวัติการเคลื่อนไหว</Text>
            </View>
          }
        />
      )}
    </View>
  );

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------
  return (
    <View style={styles.container}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(
          [
            { key: 'ingredients', label: 'วัตถุดิบ' },
            { key: 'stock_in', label: 'เติมสต็อก' },
            { key: 'history', label: 'ประวัติ' },
          ] as { key: TabKey; label: string }[]
        ).map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.75}
          >
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'ingredients' && ingredientsTab}
      {activeTab === 'stock_in' && stockInTab}
      {activeTab === 'history' && historyTab}

      <IngredientFormModal
        visible={formVisible}
        ingredient={editingIngredient}
        shopId={shop?.id ?? ''}
        onSave={saveIngredient}
        onClose={() => setFormVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // ---- Tab Bar ----
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: Colors.primary,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  tabLabelActive: {
    color: Colors.primary,
  },

  // ---- Shared ----
  tabContent: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.text.light,
    marginTop: 12,
  },

  // ---- Ingredient row ----
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  accentBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  ingredientInfo: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  ingredientName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  ingredientMeta: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  ingredientUnit: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  ingredientCost: {
    fontSize: 12,
    color: Colors.text.light,
  },
  expiryText: {
    fontSize: 11,
    color: Colors.text.light,
    marginTop: 2,
  },
  expiryTextAlert: {
    color: Colors.danger,
    fontWeight: '600',
  },
  stockBadge: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 4,
    minWidth: 56,
  },
  stockValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  stockUnit: {
    fontSize: 10,
    fontWeight: '500',
  },
  deleteBtn: {
    padding: 12,
  },

  // ---- FAB ----
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },

  // ---- Stock-in form ----
  formContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: 6,
    marginTop: 16,
  },
  pickerList: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  pickerEmpty: {
    padding: 16,
    fontSize: 14,
    color: Colors.text.light,
    textAlign: 'center',
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  pickerItemActive: {
    backgroundColor: Colors.primaryLight,
  },
  pickerItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  pickerItemNameActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  pickerItemStock: {
    fontSize: 12,
    color: Colors.text.light,
  },
  pickerItemStockActive: {
    color: Colors.primary,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typePill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  typePillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  typePillTextActive: {
    color: Colors.text.inverse,
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 15,
    color: Colors.text.primary,
    backgroundColor: Colors.surface,
  },
  inputMultiline: {
    height: 80,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  submitBtn: {
    height: 52,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.inverse,
  },

  // ---- History ----
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  txAccent: {
    width: 4,
    alignSelf: 'stretch',
  },
  txInfo: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  txIngredientName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  txNote: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 1,
  },
  txDate: {
    fontSize: 11,
    color: Colors.text.light,
    marginTop: 2,
  },
  txTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    marginRight: 8,
  },
  txTypeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  txQty: {
    fontSize: 16,
    fontWeight: '700',
    minWidth: 48,
    textAlign: 'right',
    paddingRight: 12,
  },
});
