import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/store/authStore';
import { shadow, radius } from '../../constants/theme';
import { useTheme, ThemeColors } from '../../constants/ThemeContext';
import { TeamMember, PendingUser } from '../../src/store/authStore';

export default function SettingsScreen() {
  const { colors, isDark, override, setOverride } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const shop = useAuthStore((s) => s.shop);
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);

  const isSuperAdmin = profile?.role === 'super_admin';
  const isOwner = profile?.role === 'owner';

  const team = useAuthStore((s) => s.team);
  const pendingUsers = useAuthStore((s) => s.pendingUsers);
  const fetchTeam = useAuthStore((s) => s.fetchTeam);
  const fetchPendingUsers = useAuthStore((s) => s.fetchPendingUsers);
  const createCashier = useAuthStore((s) => s.createCashier);
  const approveOwner = useAuthStore((s) => s.approveOwner);
  const removeTeamMember = useAuthStore((s) => s.removeTeamMember);

  const [shopName, setShopName] = useState('');
  const [promptpayId, setPromptpayId] = useState('');
  const [tableCount, setTableCount] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Owner: create cashier state
  const [cashierName, setCashierName] = useState('');
  const [cashierEmail, setCashierEmail] = useState('');
  const [cashierPassword, setCashierPassword] = useState('');
  const [isCreatingCashier, setIsCreatingCashier] = useState(false);

  // Super admin: approve owner state
  const [approvingUser, setApprovingUser] = useState<PendingUser | null>(null);
  const [newShopName, setNewShopName] = useState('');
  const [newPromptpay, setNewPromptpay] = useState('');
  const [isApprovingOwner, setIsApprovingOwner] = useState(false);

  // Seed local state from store when shop loads
  useEffect(() => {
    if (shop) {
      setShopName(shop.name);
      setPromptpayId(shop.promptpay_id);
      setTableCount(String(shop.table_count ?? 10));
    }
  }, [shop]);

  useEffect(() => {
    if (isOwner && shop?.id) fetchTeam();
  }, [isOwner, shop?.id]);

  useEffect(() => {
    if (isSuperAdmin) fetchPendingUsers();
  }, [isSuperAdmin]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (isSuperAdmin) await fetchPendingUsers();
      if (isOwner && shop?.id) await fetchTeam();
    } finally {
      setRefreshing(false);
    }
  };

  const checkDirty = (name: string, ppay: string, tc: string) => {
    setIsDirty(
      name !== shop?.name ||
      ppay !== shop?.promptpay_id ||
      tc !== String(shop?.table_count ?? 10)
    );
  };

  const handleShopNameChange = (val: string) => {
    setShopName(val);
    checkDirty(val, promptpayId, tableCount);
  };

  const handlePromptpayChange = (val: string) => {
    // Allow only digits and dashes (for formatted IDs)
    const cleaned = val.replace(/[^0-9-]/g, '');
    setPromptpayId(cleaned);
    checkDirty(shopName, cleaned, tableCount);
  };

  const handleTableCountChange = (val: string) => {
    // Allow only digits
    const cleaned = val.replace(/[^0-9]/g, '');
    setTableCount(cleaned);
    checkDirty(shopName, promptpayId, cleaned);
  };

  const handleSave = async () => {
    if (!shop?.id) return;

    const trimmedName = shopName.trim();
    const trimmedPromptpay = promptpayId.trim();
    const parsedTableCount = parseInt(tableCount, 10);

    if (!trimmedName) {
      Alert.alert('ข้อผิดพลาด', 'กรุณากรอกชื่อร้าน');
      return;
    }
    const ppDigits = trimmedPromptpay.replace(/\D/g, '');
    if (ppDigits.length !== 10 && ppDigits.length !== 13) {
      Alert.alert('PromptPay ID ไม่ถูกต้อง', 'กรุณากรอกเบอร์โทร (10 หลัก) หรือเลขบัตรประชาชน (13 หลัก)');
      return;
    }
    if (isNaN(parsedTableCount) || parsedTableCount < 1 || parsedTableCount > 100) {
      Alert.alert('ข้อผิดพลาด', 'จำนวนโต๊ะต้องอยู่ระหว่าง 1-100');
      return;
    }

    setIsSaving(true);
    try {
      // Save basic shop info
      const { error } = await supabase
        .from('shops')
        .update({ name: trimmedName, promptpay_id: trimmedPromptpay })
        .eq('id', shop.id);

      if (error) throw error;

      // Save table_count separately (column may not exist if migration not yet applied)
      let tableCountSaved = false;
      try {
        const { error: tcError } = await supabase
          .from('shops')
          .update({ table_count: parsedTableCount })
          .eq('id', shop.id);
        if (!tcError) tableCountSaved = true;
      } catch {
        // table_count column not yet available — ignore
      }

      // Update local authStore shop
      useAuthStore.setState((state) => {
        if (state.shop) {
          state.shop = {
            ...state.shop,
            name: trimmedName,
            promptpay_id: trimmedPromptpay,
            ...(tableCountSaved ? { table_count: parsedTableCount } : {}),
          };
        }
      });

      setIsDirty(false);
    } catch (err: unknown) {
      const message = (err as any)?.message ?? 'ไม่สามารถบันทึกได้';
      Alert.alert('เกิดข้อผิดพลาด', message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateCashier = async () => {
    if (!cashierName.trim() || !cashierEmail.trim() || !cashierPassword.trim()) {
      Alert.alert('ข้อผิดพลาด', 'กรุณากรอกข้อมูลให้ครบทุกช่อง');
      return;
    }
    setIsCreatingCashier(true);
    try {
      await createCashier(cashierName.trim(), cashierEmail.trim(), cashierPassword.trim());
      setCashierName(''); setCashierEmail(''); setCashierPassword('');
      Alert.alert('สำเร็จ', `สร้างบัญชีพนักงาน ${cashierEmail.trim()} เรียบร้อยแล้ว`);
    } catch (err: any) {
      Alert.alert('เกิดข้อผิดพลาด', err.message ?? 'สร้างบัญชีไม่สำเร็จ');
    } finally {
      setIsCreatingCashier(false);
    }
  };

  const handleApproveOwner = async () => {
    if (!approvingUser) return;
    if (!newShopName.trim() || !newPromptpay.trim()) {
      Alert.alert('ข้อผิดพลาด', 'กรุณากรอกชื่อร้านและ PromptPay ID');
      return;
    }
    setIsApprovingOwner(true);
    try {
      await approveOwner(approvingUser.id, newShopName.trim(), newPromptpay.trim());
      setApprovingUser(null); setNewShopName(''); setNewPromptpay('');
    } catch (err: any) {
      Alert.alert('เกิดข้อผิดพลาด', err.message ?? 'อนุมัติไม่สำเร็จ');
    } finally {
      setIsApprovingOwner(false);
    }
  };

  const handleRemoveMember = (member: TeamMember) => {
    if (member.id === profile?.id) return;
    Alert.alert(
      'ลบออกจากทีม',
      `ต้องการลบ "${member.full_name || member.email || 'ผู้ใช้นี้'}" ออกจากทีม?`,
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ลบ',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeTeamMember(member.id);
            } catch (err: any) {
              Alert.alert('เกิดข้อผิดพลาด', err.message ?? 'ไม่สามารถลบได้');
            }
          },
        },
      ]
    );
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Shop Settings Section — hidden for super_admin (no shop) */}
        {!isSuperAdmin && <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="storefront-outline" size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>ข้อมูลร้าน</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>ชื่อร้าน</Text>
            <TextInput
              style={[styles.input, !isOwner && styles.inputReadOnly]}
              value={shopName}
              onChangeText={handleShopNameChange}
              placeholder="ชื่อร้านของคุณ"
              placeholderTextColor={colors.text.light}
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
              placeholderTextColor={colors.text.light}
              editable={isOwner}
              keyboardType="phone-pad"
            />
            <Text style={styles.fieldHint}>รองรับ: เบอร์โทร 10 หลัก หรือเลขบัตรประชาชน 13 หลัก</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>จำนวนโต๊ะ</Text>
            <TextInput
              style={[styles.input, !isOwner && styles.inputReadOnly]}
              value={tableCount}
              onChangeText={handleTableCountChange}
              placeholder="10"
              placeholderTextColor={colors.text.light}
              editable={isOwner}
              keyboardType="numeric"
            />
            <Text style={styles.fieldHint}>ตั้งจำนวนโต๊ะในร้าน (1-100) สำหรับหน้าจัดการโต๊ะ</Text>
          </View>

          {!isOwner && (
            <View style={styles.readOnlyNotice}>
              <Ionicons name="lock-closed-outline" size={14} color={colors.text.light} />
              <Text style={styles.readOnlyText}>เฉพาะเจ้าของร้านเท่านั้นที่แก้ไขได้</Text>
            </View>
          )}
        </View>}

        {/* Save button — only visible for owners */}
        {isOwner && (
          <TouchableOpacity
            style={[styles.saveButton, (!isDirty || isSaving) && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!isDirty || isSaving}
            activeOpacity={0.8}
          >
            {isSaving ? (
              <ActivityIndicator color={colors.text.inverse} size="small" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color={colors.text.inverse} />
                <Text style={styles.saveButtonText}>บันทึก</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* User Profile Section (read-only) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person-outline" size={18} color={colors.primary} />
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
              name={isSuperAdmin ? 'star-outline' : isOwner ? 'shield-checkmark-outline' : 'person-circle-outline'}
              size={14}
              color={(isSuperAdmin || isOwner) ? colors.primary : colors.text.secondary}
            />
            <Text style={[styles.roleText, (isSuperAdmin || isOwner) && styles.roleTextOwner]}>
              {isSuperAdmin ? 'System Admin' : isOwner ? 'เจ้าของร้าน' : 'แคชเชียร์'}
            </Text>
          </View>
        </View>

        {/* ======================================================
            SUPER ADMIN: อนุมัติเจ้าของร้านใหม่
        ====================================================== */}
        {isSuperAdmin && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="star-outline" size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>อนุมัติเจ้าของร้าน</Text>
            </View>

            {pendingUsers.length === 0 ? (
              <View style={styles.emptyTeam}>
                <Ionicons name="checkmark-circle-outline" size={32} color={colors.text.light} />
                <Text style={styles.emptyTeamText}>ไม่มีผู้รออนุมัติ</Text>
              </View>
            ) : (
              pendingUsers.map((u) => (
                <View key={u.id} style={styles.teamMemberRow}>
                  <View style={styles.teamMemberAvatar}>
                    <Text style={styles.teamMemberAvatarText}>
                      {(u.full_name || u.email || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.teamMemberInfo}>
                    <Text style={styles.teamMemberName} numberOfLines={1}>
                      {u.full_name || '(ไม่ระบุชื่อ)'}
                    </Text>
                    <Text style={styles.teamMemberEmail} numberOfLines={1}>
                      {u.email}
                    </Text>
                    {u.pending_shop_name ? (
                      <Text style={styles.teamMemberEmail} numberOfLines={1}>
                        ร้าน: {u.pending_shop_name}
                      </Text>
                    ) : (
                      <Text style={[styles.teamMemberEmail, { color: colors.text.light, fontStyle: 'italic' }]} numberOfLines={1}>
                        ยังไม่ได้กรอกข้อมูลร้าน
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.approvePill}
                    onPress={() => {
                      setApprovingUser(u);
                      setNewShopName(u.pending_shop_name ?? '');
                      setNewPromptpay(u.pending_promptpay ?? '');
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="checkmark-circle" size={16} color={colors.text.inverse} />
                    <Text style={styles.approvePillText}>อนุมัติ</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}

            {/* Approve modal-like inline form */}
            {approvingUser && (
              <View style={styles.approveForm}>
                <Text style={styles.approveFormTitle}>
                  อนุมัติ: {approvingUser.full_name || approvingUser.email}
                </Text>
                {approvingUser.pending_shop_name ? (
                  <Text style={[styles.fieldHint, { marginBottom: 8 }]}>
                    ข้อมูลจากเจ้าของร้าน (แก้ไขได้)
                  </Text>
                ) : null}
                <TextInput
                  style={styles.input}
                  value={newShopName}
                  onChangeText={setNewShopName}
                  placeholder="ชื่อร้าน"
                  placeholderTextColor={colors.text.light}
                />
                <TextInput
                  style={[styles.input, { marginTop: 8 }]}
                  value={newPromptpay}
                  onChangeText={setNewPromptpay}
                  placeholder="PromptPay ID (เบอร์โทร / เลขบัตร)"
                  placeholderTextColor={colors.text.light}
                  keyboardType="phone-pad"
                />
                <View style={styles.roleRow}>
                  <TouchableOpacity
                    style={[styles.rolePillSel, { flex: 2 }]}
                    onPress={() => setApprovingUser(null)}
                  >
                    <Text style={styles.rolePillSelText}>ยกเลิก</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.rolePillSel, styles.rolePillSelActive, { flex: 3 },
                      (!newShopName.trim() || !newPromptpay.trim() || isApprovingOwner) && styles.saveButtonDisabled]}
                    onPress={handleApproveOwner}
                    disabled={!newShopName.trim() || !newPromptpay.trim() || isApprovingOwner}
                  >
                    {isApprovingOwner
                      ? <ActivityIndicator color={colors.text.inverse} size="small" />
                      : <Text style={styles.rolePillSelTextActive}>ยืนยันอนุมัติ</Text>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            )}

          </View>
        )}

        {/* ======================================================
            OWNER: สร้างบัญชีพนักงาน
        ====================================================== */}
        {isOwner && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="people-outline" size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>จัดการพนักงาน</Text>
            </View>

            <Text style={styles.fieldLabel}>สร้างบัญชีพนักงานใหม่</Text>
            <TextInput
              style={styles.input}
              value={cashierName}
              onChangeText={setCashierName}
              placeholder="ชื่อพนักงาน"
              placeholderTextColor={colors.text.light}
              editable={!isCreatingCashier}
            />
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              value={cashierEmail}
              onChangeText={setCashierEmail}
              placeholder="อีเมล (ใช้ login)"
              placeholderTextColor={colors.text.light}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isCreatingCashier}
            />
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              value={cashierPassword}
              onChangeText={setCashierPassword}
              placeholder="รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)"
              placeholderTextColor={colors.text.light}
              secureTextEntry
              editable={!isCreatingCashier}
            />

            <TouchableOpacity
              style={[styles.saveButton, { marginTop: 12 },
                (!cashierName.trim() || !cashierEmail.trim() || !cashierPassword.trim() || isCreatingCashier)
                  && styles.saveButtonDisabled]}
              onPress={handleCreateCashier}
              disabled={!cashierName.trim() || !cashierEmail.trim() || !cashierPassword.trim() || isCreatingCashier}
              activeOpacity={0.8}
            >
              {isCreatingCashier ? (
                <ActivityIndicator color={colors.text.inverse} size="small" />
              ) : (
                <>
                  <Ionicons name="person-add-outline" size={16} color={colors.text.inverse} />
                  <Text style={styles.saveButtonText}>สร้างบัญชีพนักงาน</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Current team list */}
            {team.length > 0 && (
              <>
                <View style={styles.teamDivider} />
                <Text style={styles.fieldLabel}>พนักงานปัจจุบัน</Text>
                {team.map((member) => (
                  <View key={member.id} style={styles.teamMemberRow}>
                    <View style={styles.teamMemberAvatar}>
                      <Text style={styles.teamMemberAvatarText}>
                        {(member.full_name || member.email || '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.teamMemberInfo}>
                      <Text style={styles.teamMemberName} numberOfLines={1}>
                        {member.full_name || '—'}
                      </Text>
                      {member.email ? (
                        <Text style={styles.teamMemberEmail} numberOfLines={1}>{member.email}</Text>
                      ) : null}
                    </View>
                    <View style={[styles.teamRoleBadge,
                      member.role === 'owner' ? styles.teamRoleBadgeOwner : styles.teamRoleBadgeCashier]}>
                      <Text style={[styles.teamRoleText,
                        member.role === 'owner' ? styles.teamRoleTextOwner : styles.teamRoleTextCashier]}>
                        {member.role === 'owner' ? 'เจ้าของ' : 'พนักงาน'}
                      </Text>
                    </View>
                    {member.id !== profile?.id && (
                      <TouchableOpacity style={styles.teamRemoveBtn} onPress={() => handleRemoveMember(member)}>
                        <Ionicons name="close-circle-outline" size={20} color={colors.danger} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        {/* Dark Mode Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="contrast-outline" size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>ธีม</Text>
          </View>

          <View style={styles.themeRow}>
            {/* Light */}
            <TouchableOpacity
              style={[styles.themePill, !isDark && styles.themePillActive]}
              onPress={() => setOverride('light')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="sunny-outline"
                size={16}
                color={!isDark ? colors.text.inverse : colors.text.secondary}
              />
              <Text style={[styles.themePillText, !isDark && styles.themePillTextActive]}>
                สว่าง
              </Text>
            </TouchableOpacity>

            {/* Dark */}
            <TouchableOpacity
              style={[styles.themePill, isDark && styles.themePillActive]}
              onPress={() => setOverride('dark')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="moon-outline"
                size={16}
                color={isDark ? colors.text.inverse : colors.text.secondary}
              />
              <Text style={[styles.themePillText, isDark && styles.themePillTextActive]}>
                มืด
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* App info */}
        <Text style={styles.version}>QRForPay POS v1.0</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 16,
    ...shadow.md,
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
    color: colors.text.primary,
  },
  field: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text.primary,
    backgroundColor: colors.background,
  },
  inputReadOnly: {
    backgroundColor: colors.borderLight,
    color: colors.text.secondary,
    borderColor: colors.borderLight,
  },
  fieldHint: {
    fontSize: 11,
    color: colors.text.light,
    marginTop: 4,
  },
  readOnlyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  readOnlyText: {
    fontSize: 12,
    color: colors.text.light,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    height: 52,
    marginBottom: 16,
    ...shadow.md,
  },
  saveButtonDisabled: {
    opacity: 0.45,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.inverse,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  infoRowLast: {
    borderBottomWidth: 0,
    marginBottom: 10,
  },
  infoLabel: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '500',
    maxWidth: '60%',
    textAlign: 'right',
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: colors.background,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  roleTextOwner: {
    color: colors.primary,
  },
  // Dark mode toggle
  themeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  themePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  themePillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  themePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  themePillTextActive: {
    color: colors.text.inverse,
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.text.light,
    marginTop: 8,
  },
  // Team management
  roleRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    marginBottom: 10,
  },
  rolePillSel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  rolePillSelActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  rolePillSelText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  rolePillSelTextActive: {
    color: colors.text.inverse,
  },
  approvePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: 16,
    paddingVertical: 10,
    ...shadow.sm,
  },
  approvePillText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.inverse,
  },
  teamDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 16,
  },
  teamMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: 10,
  },
  teamMemberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamMemberAvatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  teamMemberInfo: {
    flex: 1,
    minWidth: 0,
  },
  teamMemberName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  teamMemberEmail: {
    fontSize: 12,
    color: colors.text.light,
    marginTop: 1,
  },
  teamRoleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  teamRoleBadgeOwner: {
    backgroundColor: colors.primaryLight,
  },
  teamRoleBadgeCashier: {
    backgroundColor: colors.borderLight,
  },
  teamRoleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  teamRoleTextOwner: {
    color: colors.primary,
  },
  teamRoleTextCashier: {
    color: colors.text.secondary,
  },
  teamRemoveBtn: {
    padding: 4,
  },
  emptyTeam: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  emptyTeamText: {
    fontSize: 13,
    color: colors.text.light,
  },
  approveForm: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  approveFormTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 10,
  },
  refreshRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
    alignSelf: 'center',
  },
});
