import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/store/authStore';
import { Colors } from '../../constants/colors';

export default function SettingsScreen() {
  const shop = useAuthStore((s) => s.shop);
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);

  const isOwner = profile?.role === 'owner';

  const [shopName, setShopName] = useState('');
  const [promptpayId, setPromptpayId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Seed local state from store when shop loads
  useEffect(() => {
    if (shop) {
      setShopName(shop.name);
      setPromptpayId(shop.promptpay_id);
    }
  }, [shop]);

  // Track whether the user has changed anything
  const handleShopNameChange = (val: string) => {
    setShopName(val);
    setIsDirty(val !== shop?.name || promptpayId !== shop?.promptpay_id);
  };

  const handlePromptpayChange = (val: string) => {
    setPromptpayId(val);
    setIsDirty(shopName !== shop?.name || val !== shop?.promptpay_id);
  };

  const handleSave = async () => {
    if (!shop?.id) return;

    const trimmedName = shopName.trim();
    const trimmedPromptpay = promptpayId.trim();

    if (!trimmedName) {
      Alert.alert('ข้อผิดพลาด', 'กรุณากรอกชื่อร้าน');
      return;
    }
    if (!trimmedPromptpay) {
      Alert.alert('ข้อผิดพลาด', 'กรุณากรอก PromptPay ID');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('shops')
        .update({ name: trimmedName, promptpay_id: trimmedPromptpay })
        .eq('id', shop.id);

      if (error) throw error;

      Alert.alert('บันทึกแล้ว', 'อัปเดตข้อมูลร้านเรียบร้อยแล้ว');
      setIsDirty(false);
    } catch (err: unknown) {
      const message = (err as any)?.message ?? 'ไม่สามารถบันทึกได้';
      Alert.alert('เกิดข้อผิดพลาด', message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Shop Settings Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="storefront-outline" size={18} color={Colors.primary} />
            <Text style={styles.sectionTitle}>ข้อมูลร้าน</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>ชื่อร้าน</Text>
            <TextInput
              style={[styles.input, !isOwner && styles.inputReadOnly]}
              value={shopName}
              onChangeText={handleShopNameChange}
              placeholder="ชื่อร้านของคุณ"
              placeholderTextColor={Colors.text.light}
              editable={isOwner}
              returnKeyType="next"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>PromptPay ID</Text>
            <TextInput
              style={[styles.input, !isOwner && styles.inputReadOnly]}
              value={promptpayId}
              onChangeText={handlePromptpayChange}
              placeholder="เบอร์โทรหรือเลขบัตรประชาชน"
              placeholderTextColor={Colors.text.light}
              editable={isOwner}
              keyboardType="phone-pad"
              returnKeyType="done"
            />
            <Text style={styles.fieldHint}>รองรับ: เบอร์โทร 10 หลัก หรือเลขบัตรประชาชน 13 หลัก</Text>
          </View>

          {!isOwner && (
            <View style={styles.readOnlyNotice}>
              <Ionicons name="lock-closed-outline" size={14} color={Colors.text.light} />
              <Text style={styles.readOnlyText}>เฉพาะเจ้าของร้านเท่านั้นที่แก้ไขได้</Text>
            </View>
          )}
        </View>

        {/* Save button — only visible for owners */}
        {isOwner && (
          <TouchableOpacity
            style={[styles.saveButton, (!isDirty || isSaving) && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!isDirty || isSaving}
            activeOpacity={0.8}
          >
            {isSaving ? (
              <ActivityIndicator color={Colors.surface} size="small" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color={Colors.surface} />
                <Text style={styles.saveButtonText}>บันทึก</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* User Profile Section (read-only) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person-outline" size={18} color={Colors.primary} />
            <Text style={styles.sectionTitle}>ข้อมูลผู้ใช้</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>ชื่อ</Text>
            <Text style={styles.infoValue}>{profile?.full_name ?? '—'}</Text>
          </View>

          <View style={[styles.infoRow, styles.infoRowLast]}>
            <Text style={styles.infoLabel}>อีเมล</Text>
            <Text style={styles.infoValue}>{user?.email ?? '—'}</Text>
          </View>

          <View style={styles.rolePill}>
            <Ionicons
              name={isOwner ? 'shield-checkmark-outline' : 'person-circle-outline'}
              size={14}
              color={isOwner ? Colors.primary : Colors.text.secondary}
            />
            <Text style={[styles.roleText, isOwner && styles.roleTextOwner]}>
              {isOwner ? 'เจ้าของร้าน' : 'แคชเชียร์'}
            </Text>
          </View>
        </View>

        {/* App info */}
        <Text style={styles.version}>EasyShop POS v1.0</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  field: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text.primary,
    backgroundColor: Colors.surface,
  },
  inputReadOnly: {
    backgroundColor: Colors.background,
    color: Colors.text.secondary,
  },
  fieldHint: {
    fontSize: 11,
    color: Colors.text.light,
    marginTop: 4,
  },
  readOnlyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  readOnlyText: {
    fontSize: 12,
    color: Colors.text.light,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonDisabled: {
    backgroundColor: Colors.text.light,
    shadowOpacity: 0,
    elevation: 0,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.surface,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  infoRowLast: {
    borderBottomWidth: 0,
    marginBottom: 10,
  },
  infoLabel: {
    fontSize: 13,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: Colors.text.primary,
    fontWeight: '500',
    maxWidth: '60%',
    textAlign: 'right',
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  roleTextOwner: {
    color: Colors.primary,
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.text.light,
    marginTop: 8,
  },
});
