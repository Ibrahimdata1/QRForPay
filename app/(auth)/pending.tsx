import { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../src/store/authStore';
import { useTheme, ThemeColors } from '../../constants/ThemeContext';
import { radius, shadow } from '../../constants/theme';

export default function PendingScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <View style={styles.container}>
      {/* Top gradient accent */}
      <LinearGradient
        colors={colors.gradient.primary as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.topAccent}
      />

      <View style={styles.card}>
        {/* Icon */}
        <View style={styles.iconCircle}>
          <Ionicons name="time-outline" size={40} color={colors.primary} />
        </View>

        <Text style={styles.title}>รอการอนุมัติ</Text>
        <Text style={styles.subtitle}>
          ส่งข้อมูลร้านแล้ว รอ admin อนุมัติบัญชีของคุณ
        </Text>

        {/* User email */}
        {user?.email ? (
          <View style={styles.emailBadge}>
            <Ionicons name="mail-outline" size={14} color={colors.primary} />
            <Text style={styles.emailText} numberOfLines={1}>
              {user.email}
            </Text>
          </View>
        ) : null}

        {/* Submitted shop info */}
        {profile?.pending_shop_name ? (
          <View style={styles.shopInfoBox}>
            <View style={styles.shopInfoRow}>
              <Ionicons name="storefront-outline" size={15} color={colors.text.secondary} />
              <Text style={styles.shopInfoLabel}>ชื่อร้าน</Text>
              <Text style={styles.shopInfoValue}>{profile.pending_shop_name}</Text>
            </View>
            {profile.pending_promptpay ? (
              <View style={styles.shopInfoRow}>
                <Ionicons name="qr-code-outline" size={15} color={colors.text.secondary} />
                <Text style={styles.shopInfoLabel}>PromptPay</Text>
                <Text style={styles.shopInfoValue}>{profile.pending_promptpay}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.hint}>
          admin จะอนุมัติบัญชีของคุณเร็ว ๆ นี้{'\n'}
          หน้านี้จะอัปเดตอัตโนมัติเมื่อได้รับการอนุมัติ
        </Text>

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
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  topAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    ...shadow.lg,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginBottom: 20,
    maxWidth: '100%',
  },
  emailText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
    flexShrink: 1,
  },
  shopInfoBox: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: 14,
    gap: 10,
    marginBottom: 20,
  },
  shopInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shopInfoLabel: {
    fontSize: 13,
    color: colors.text.secondary,
    width: 70,
  },
  shopInfoValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  hint: {
    fontSize: 13,
    color: colors.text.light,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
  },
  signOutText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
});
