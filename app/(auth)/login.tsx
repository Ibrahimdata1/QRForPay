import { useState } from 'react';
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
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../src/store/authStore';

export default function LoginScreen() {
  const { height: SCREEN_HEIGHT } = useWindowDimensions();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const signIn = useAuthStore((s) => s.signIn);
  const isLoading = useAuthStore((s) => s.isLoading);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }
    setError('');
    try {
      await signIn(email.trim(), password);
      router.replace('/(pos)');
    } catch (err: any) {
      setError(err.message || 'เข้าสู่ระบบไม่สำเร็จ');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Top teal section — 38% height */}
      <View style={[styles.topSection, { height: SCREEN_HEIGHT * 0.38 }]}>
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
      </View>

      {/* Bottom white card — 62% height */}
      <View style={styles.bottomCard}>
        <Text style={styles.welcomeTitle}>ยินดีต้อนรับ</Text>
        <Text style={styles.welcomeSubtitle}>เข้าสู่ระบบเพื่อเริ่มขาย</Text>

        <Text style={styles.label}>อีเมล</Text>
        <View style={[styles.inputContainer, emailFocused && styles.inputContainerFocused]}>
          <Ionicons
            name="mail-outline"
            size={20}
            color={emailFocused ? Colors.primary : Colors.text.light}
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="your@email.com"
            placeholderTextColor={Colors.text.light}
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
            color={passwordFocused ? Colors.primary : Colors.text.light}
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={Colors.text.light}
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
              color={Colors.text.light}
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
            <ActivityIndicator color={Colors.surface} />
          ) : (
            <Text style={styles.loginButtonText}>เข้าสู่ระบบ</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  topSection: {
    backgroundColor: Colors.primary,
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
    width: 22,
    height: 22,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  posSquareAccent: {
    backgroundColor: '#F59E0B',
  },
  brandName: {
    fontSize: 30,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  brandTagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.70)',
    marginTop: 4,
    letterSpacing: 0.3,
  },
  bottomCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 32,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 28,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 6,
    marginTop: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 12,
  },
  inputContainerFocused: {
    borderColor: Colors.primary,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 15,
    color: Colors.text.primary,
  },
  eyeIcon: {
    padding: 4,
  },
  errorText: {
    fontSize: 13,
    color: Colors.danger,
    marginTop: 10,
    marginLeft: 2,
  },
  loginButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 4,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: Colors.surface,
    fontSize: 16,
    fontWeight: '700',
  },
});
