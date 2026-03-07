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
import Svg, { Path, G, ClipPath, Rect, Defs, Circle, Line } from 'react-native-svg';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { shadow, radius } from '../../constants/theme';
import { useAuthStore } from '../../src/store/authStore';
import { useTheme, ThemeColors } from '../../constants/ThemeContext';

// Decorative dot grid — rendered with SVG for crisp output at all densities
function DotGrid({ width, height }: { width: number; height: number }) {
  const dots = [];
  const gap = 28;
  const cols = Math.ceil(width / gap) + 1;
  const rows = Math.ceil(height / gap) + 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      dots.push(
        <Circle
          key={`${r}-${c}`}
          cx={c * gap}
          cy={r * gap}
          r={1.5}
          fill="rgba(255,255,255,0.18)"
        />
      );
    }
  }
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFillObject}>
      {dots}
    </Svg>
  );
}

// QR-inspired logo mark — minimal, premium
function QRLogo() {
  return (
    <Svg width={72} height={72} viewBox="0 0 72 72">
      <Defs>
        <ClipPath id="outer">
          <Rect x="0" y="0" width="72" height="72" rx="18" />
        </ClipPath>
      </Defs>
      {/* Glass card background */}
      <Rect x="0" y="0" width="72" height="72" rx="18" fill="rgba(255,255,255,0.15)" />
      <Rect x="0" y="0" width="72" height="72" rx="18" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />

      {/* Top-left finder pattern */}
      <Rect x="12" y="12" width="18" height="18" rx="4" fill="rgba(255,255,255,0.9)" />
      <Rect x="16" y="16" width="10" height="10" rx="2" fill="rgba(255,255,255,0.15)" />

      {/* Top-right finder pattern */}
      <Rect x="42" y="12" width="18" height="18" rx="4" fill="rgba(255,255,255,0.9)" />
      <Rect x="46" y="16" width="10" height="10" rx="2" fill="rgba(255,255,255,0.15)" />

      {/* Bottom-left finder pattern */}
      <Rect x="12" y="42" width="18" height="18" rx="4" fill="rgba(255,255,255,0.9)" />
      <Rect x="16" y="46" width="10" height="10" rx="2" fill="rgba(255,255,255,0.15)" />

      {/* Bottom-right data modules — varied for character */}
      <Rect x="42" y="42" width="7" height="7" rx="2" fill="rgba(255,255,255,0.75)" />
      <Rect x="51" y="42" width="7" height="7" rx="2" fill="rgba(255,255,255,0.45)" />
      <Rect x="42" y="51" width="7" height="7" rx="2" fill="rgba(255,255,255,0.45)" />
      <Rect x="51" y="51" width="7" height="7" rx="2" fill="rgba(255,255,255,0.9)" />

      {/* Center accent dot — the "pay" symbol */}
      <Circle cx="36" cy="36" r="4" fill="rgba(255,255,255,0.95)" />
      <Circle cx="36" cy="36" r="2" fill="rgba(15,118,110,0.6)" />
    </Svg>
  );
}

export default function LoginScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
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
    } catch (err: any) {
      setGoogleError(err.message || 'เข้าสู่ระบบ Google ไม่สำเร็จ');
    }
  };

  const heroHeight = SCREEN_HEIGHT * 0.40;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* ── Hero section ─────────────────────────────── */}
      <LinearGradient
        colors={isDark
          ? ['#021A18', '#053D38', '#0A6560'] as [string, string, string]
          : ['#053D38', '#0A6560', '#0F9688'] as [string, string, string]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={[styles.topSection, { height: heroHeight }]}
      >
        {/* Dot grid decorative background */}
        <DotGrid width={SCREEN_WIDTH} height={heroHeight} />

        {/* Radial glow behind logo */}
        <View style={styles.glowRing} />

        {/* Logo mark */}
        <View style={styles.logoWrapper}>
          <QRLogo />
        </View>

        {/* Brand text */}
        <Text style={styles.brandName}>QRForPay</Text>
        <View style={styles.taglineRow}>
          <View style={styles.taglineBadge}>
            <Text style={styles.brandTagline}>ระบบขายหน้าร้าน</Text>
          </View>
        </View>
      </LinearGradient>

      {/* ── Form card ────────────────────────────────── */}
      <View style={styles.bottomCard}>
        {/* Pull handle */}
        <View style={styles.pullHandle} />

        <Text style={styles.welcomeTitle}>ยินดีต้อนรับ</Text>
        <Text style={styles.welcomeSubtitle}>เข้าสู่ระบบเพื่อเริ่มขาย</Text>

        {/* Email field */}
        <Text style={styles.label}>อีเมล</Text>
        <View style={[
          styles.inputContainer,
          emailFocused && styles.inputContainerFocused,
        ]}>
          <Ionicons
            name="mail-outline"
            size={18}
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
          {email.length > 0 && (
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          )}
        </View>

        {/* Password field */}
        <Text style={styles.label}>รหัสผ่าน</Text>
        <View style={[
          styles.inputContainer,
          passwordFocused && styles.inputContainerFocused,
        ]}>
          <Ionicons
            name="lock-closed-outline"
            size={18}
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
              size={18}
              color={colors.text.light}
            />
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle-outline" size={14} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Login CTA — gradient button */}
        <TouchableOpacity
          style={[styles.loginButtonWrapper, isLoading && styles.loginButtonDisabled]}
          onPress={handleLogin}
          activeOpacity={0.85}
          disabled={isLoading}
        >
          <LinearGradient
            colors={['#064E46', '#0F9688'] as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.loginButton}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.loginButtonText}>เข้าสู่ระบบ</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>หรือเข้าสู่ระบบด้วย</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Google Sign-In — standard white pill */}
        <TouchableOpacity
          style={[styles.googleButton, isLoading && styles.loginButtonDisabled]}
          onPress={handleGoogleLogin}
          activeOpacity={0.85}
          disabled={isLoading}
        >
          {/* Official Google "G" logo */}
          <View style={styles.googleIconWrapper}>
            <Svg width={18} height={18} viewBox="0 0 48 48">
              <Defs>
                <ClipPath id="g">
                  <Path d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z" />
                </ClipPath>
              </Defs>
              <G clipPath="url(#g)">
                <Path d="M0 37V11l17 13z" fill="#FBBC05" />
                <Path d="M0 11l17 13 7-6.1L48 14V0H0z" fill="#EA4335" />
                <Path d="M0 37l30-23 7.9 1L48 0v48H0z" fill="#34A853" />
                <Path d="M48 48L17 24l-4-3 35-10z" fill="#4285F4" />
              </G>
            </Svg>
          </View>
          <Text style={styles.googleButtonText}>Google</Text>
        </TouchableOpacity>

        {googleError ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle-outline" size={14} color={colors.danger} />
            <Text style={styles.errorText}>{googleError}</Text>
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDark ? '#021A18' : '#053D38',
  },
  // ── Hero ─────────────────────────────────────────
  topSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 20,
    overflow: 'hidden',
  },
  glowRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(20,184,166,0.18)',
    // soft radial glow via shadow
    shadowColor: '#2DD4BF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 48,
    elevation: 0,
  },
  logoWrapper: {
    marginBottom: 20,
    // Subtle drop shadow on the glass card
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  brandName: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  taglineRow: {
    marginTop: 10,
  },
  taglineBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  brandTagline: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.90)',
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },

  // ── Form card ────────────────────────────────────
  bottomCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    // Pronounced upward shadow to separate hero from card
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: isDark ? 0.5 : 0.12,
    shadowRadius: 24,
    elevation: 16,
  },
  pullHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text.primary,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 28,
    fontWeight: '400',
  },

  // ── Inputs ───────────────────────────────────────
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 8,
    marginTop: 16,
    letterSpacing: 0.2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 14,
    // Subtle inner shadow feel via elevation
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: isDark ? 0.3 : 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  inputContainerFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: 15,
    color: colors.text.primary,
    fontWeight: '400',
    ...(Platform.OS === 'web' && { outlineWidth: 0 }),
  },
  eyeIcon: {
    padding: 6,
  },

  // ── Error ────────────────────────────────────────
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    marginLeft: 2,
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
    fontWeight: '500',
  },

  // ── Login CTA ────────────────────────────────────
  loginButtonWrapper: {
    marginTop: 28,
    borderRadius: radius.lg,
    overflow: 'hidden',
    shadowColor: '#064E46',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  loginButton: {
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginButtonDisabled: {
    opacity: 0.45,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // ── Divider ──────────────────────────────────────
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
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
    letterSpacing: 0.3,
  },

  // ── Google button ────────────────────────────────
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    height: 52,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.3 : 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  googleIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F8FAFC',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButtonText: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
