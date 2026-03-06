import { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
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
  const signOut = useAuthStore((s) => s.signOut);
  const initialize = useAuthStore((s) => s.initialize);
  const isLoading = useAuthStore((s) => s.isLoading);

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
          บัญชีของคุณอยู่ระหว่างรอการอนุมัติจากเจ้าของร้าน
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

        <Text style={styles.hint}>
          กรุณาแจ้งเจ้าของร้านให้อนุมัติบัญชีของคุณใน{'\n'}
          หน้า ตั้งค่า → จัดการทีม
        </Text>

        {/* Refresh button */}
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={initialize}
          activeOpacity={0.8}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <>
              <Ionicons name="refresh-outline" size={18} color={colors.primary} />
              <Text style={styles.refreshText}>ตรวจสอบสถานะ</Text>
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
  hint: {
    fontSize: 13,
    color: colors.text.light,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.md,
    height: 48,
    width: '100%',
    marginBottom: 12,
  },
  refreshText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
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
