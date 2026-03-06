import { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { shadow, radius } from '../../constants/theme';
import { useAuthStore } from '../../src/store/authStore';
import { useTheme, ThemeColors } from '../../constants/ThemeContext';

export default function LoginScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { height: SCREEN_HEIGHT } = useWindowDimensions();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const [googleError, setGoogleError] = useState('');
  const signIn = useAuthStore((s) => s.signIn);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const isLoading = useAuthStore((s) => s.isLoading);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }
    setError('');
    setGoogleError('');
    try {
      await signIn(email.trim(), password);
      router.replace('/(pos)');
    } catch (err: any) {
      setError(err.message || 'เข้าสู่ระบบไม่สำเร็จ');
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleError('');
    try {
      await signInWithGoogle();
      // On native: _layout.tsx handles redirect after initialize() completes
      // On web: full-page redirect happens, so nothing to do here
    } catch (err: any) {
      setGoogleError(err.message || 'เข้าสู่ระบบ Google ไม่สำเร็จ');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Top gradient hero — 38% height */}
      <LinearGradient
        colors={colors.gradient.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.topSection, { height: SCREEN_HEIGHT * 0.38 }]}
      >
        {/* POS icon: 2×2 grid of squares */}
        <View style={styles.posIcon}>
          <View style={styles.posIconRow}>
            <View style={styles.posSquare} />
            <View style={styles.posSquare} />
          </View>
          <View style={styles.posIconRow}>
            <View style={styles.posSquare} />
            <View style={[styles.posSquare, styles.posSquareAccent]} />
          </View>
        </View>
        <Text style={styles.brandName}>QRForPay</Text>
        <Text style={styles.brandTagline}>ระบบขายหน้าร้าน</Text>
      </LinearGradient>

      {/* Bottom card — 62% height */}
      <View style={styles.bottomCard}>
        <Text style={styles.welcomeTitle}>ยินดีต้อนรับ</Text>
        <Text style={styles.welcomeSubtitle}>เข้าสู่ระบบเพื่อเริ่มขาย</Text>

        <Text style={styles.label}>อีเมล</Text>
        <View style={[styles.inputContainer, emailFocused && styles.inputContainerFocused]}>
          <Ionicons
            name="mail-outline"
            size={20}
            color={emailFocused ? colors.primary : colors.text.light}
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="your@email.com"
            placeholderTextColor={colors.text.light}
            value={email}
            onChangeText={setEmail}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
          />
        </View>

        <Text style={styles.label}>รหัสผ่าน</Text>
        <View style={[styles.inputContainer, passwordFocused && styles.inputContainerFocused]}>
          <Ionicons
            name="lock-closed-outline"
            size={20}
            color={passwordFocused ? colors.primary : colors.text.light}
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={colors.text.light}
            value={password}
            onChangeText={setPassword}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
            secureTextEntry={!showPassword}
            editable={!isLoading}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.text.light}
            />
          </TouchableOpacity>
        </View>

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}

        <TouchableOpacity
          style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
          onPress={handleLogin}
          activeOpacity={0.8}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.text.inverse} />
          ) : (
            <Text style={styles.loginButtonText}>เข้าสู่ระบบ</Text>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>หรือ</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Google Sign-In */}
        <TouchableOpacity
          style={[styles.googleButton, isLoading && styles.loginButtonDisabled]}
          onPress={handleGoogleLogin}
          activeOpacity={0.8}
          disabled={isLoading}
        >
          {/* Google "G" icon via colored squares */}
          <View style={styles.googleIcon}>
            <Text style={styles.googleIconText}>G</Text>
          </View>
          <Text style={styles.googleButtonText}>เข้าสู่ระบบด้วย Google</Text>
        </TouchableOpacity>

        {googleError ? (
          <Text style={styles.errorText}>{googleError}</Text>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  topSection: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 16,
  },
  posIcon: {
    gap: 6,
    marginBottom: 20,
  },
  posIconRow: {
    flexDirection: 'row',
    gap: 6,
  },
  posSquare: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  posSquareAccent: {
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  brandName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 6,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  bottomCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 32,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 28,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 6,
    marginTop: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 12,
  },
  inputContainerFocused: {
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
    ...(Platform.OS === 'web' && { outlineWidth: 0 }),
  },
  eyeIcon: {
    padding: 4,
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
    marginTop: 10,
    marginLeft: 2,
  },
  loginButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
    ...shadow.md,
  },
  loginButtonDisabled: {
    opacity: 0.45,
  },
  loginButtonText: {
    color: colors.text.inverse,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: 12,
    color: colors.text.light,
    fontWeight: '500',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    height: 52,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadow.sm,
  },
  googleIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIconText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  googleButtonText: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '600',
  },
});
