import { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { useTheme, ThemeColors } from '../../constants/ThemeContext';
import { radius, shadow } from '../../constants/theme';

export default function RegisterShopScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const user = useAuthStore((s) => s.user);
  const submitOwnerInfo = useAuthStore((s) => s.submitOwnerInfo);
  const signOut = useAuthStore((s) => s.signOut);

  const [shopName, setShopName] = useState('');
  const [promptpayId, setPromptpayId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [shopNameFocused, setShopNameFocused] = useState(false);
  const [promptpayFocused, setPromptpayFocused] = useState(false);

  const handleSubmit = async () => {
    if (!shopName.trim()) {
      setError('กรุณากรอกชื่อร้าน');
      return;
    }
    if (!promptpayId.trim()) {
      setError('กรุณากรอก PromptPay ID');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await submitOwnerInfo(shopName.trim(), promptpayId.trim());
      router.replace('/(auth)/pending');
    } catch (err: any) {
      setError(err.message || 'ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.outer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Top gradient accent */}
      <LinearGradient
        colors={colors.gradient.primary as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.topAccent}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          {/* Icon */}
          <View style={styles.iconCircle}>
            <Ionicons name="storefront-outline" size={40} color={colors.primary} />
          </View>

          <Text style={styles.title}>ข้อมูลร้านของคุณ</Text>
          <Text style={styles.subtitle}>
            กรอกชื่อร้านและ PromptPay ID เพื่อส่งให้แอดมินอนุมัติ
          </Text>

          {/* User email badge */}
          {user?.email ? (
            <View style={styles.emailBadge}>
              <Ionicons name="mail-outline" size={14} color={colors.primary} />
              <Text style={styles.emailText} numberOfLines={1}>
                {user.email}
              </Text>
            </View>
          ) : null}

          {/* Shop name input */}
          <Text style={styles.label}>ชื่อร้าน</Text>
          <View style={[styles.inputContainer, shopNameFocused && styles.inputFocused]}>
            <Ionicons
              name="storefront-outline"
              size={20}
              color={shopNameFocused ? colors.primary : colors.text.light}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="เช่น ร้านก๋วยเตี๋ยวป้าแดง"
              placeholderTextColor={colors.text.light}
              value={shopName}
              onChangeText={setShopName}
              onFocus={() => setShopNameFocused(true)}
              onBlur={() => setShopNameFocused(false)}
              editable={!isSubmitting}
              returnKeyType="next"
              autoCorrect={false}
            />
          </View>

          {/* PromptPay ID input */}
          <Text style={[styles.label, { marginTop: 16 }]}>PromptPay ID</Text>
          <View style={[styles.inputContainer, promptpayFocused && styles.inputFocused]}>
            <Ionicons
              name="qr-code-outline"
              size={20}
              color={promptpayFocused ? colors.primary : colors.text.light}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="เบอร์โทร 10 หลัก หรือเลขบัตร 13 หลัก"
              placeholderTextColor={colors.text.light}
              value={promptpayId}
              onChangeText={setPromptpayId}
              onFocus={() => setPromptpayFocused(true)}
              onBlur={() => setPromptpayFocused(false)}
              keyboardType="phone-pad"
              editable={!isSubmitting}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
          </View>
          <Text style={styles.hint}>ใช้สำหรับรับเงินผ่าน QR PromptPay ในร้าน</Text>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Submit button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!shopName.trim() || !promptpayId.trim() || isSubmitting) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!shopName.trim() || !promptpayId.trim() || isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.text.inverse} />
            ) : (
              <>
                <Ionicons name="send-outline" size={18} color={colors.text.inverse} />
                <Text style={styles.submitButtonText}>ส่งข้อมูลให้แอดมินอนุมัติ</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Sign out */}
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={signOut}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={16} color={colors.text.secondary} />
            <Text style={styles.signOutText}>ออกจากระบบ</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    paddingTop: 48,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 420,
    ...shadow.lg,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  emailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginBottom: 24,
    maxWidth: '100%',
  },
  emailText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
    flexShrink: 1,
  },
  label: {
    alignSelf: 'flex-start',
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 12,
  },
  inputFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: 15,
    color: colors.text.primary,
    ...(Platform.OS === 'web' && { outlineWidth: 0 } as any),
  },
  hint: {
    alignSelf: 'flex-start',
    fontSize: 12,
    color: colors.text.light,
    marginTop: 6,
    marginBottom: 4,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
    flexShrink: 1,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    height: 56,
    width: '100%',
    marginTop: 24,
    ...shadow.md,
  },
  submitButtonDisabled: {
    opacity: 0.45,
  },
  submitButtonText: {
    color: colors.text.inverse,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    padding: 8,
  },
  signOutText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
});
