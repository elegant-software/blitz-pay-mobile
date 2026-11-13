import BrandLogo from '../components/BrandLogo';
import { useTheme } from '../lib/ThemeContext';
import { LanguageSelector } from '../features/app-language/components/LanguageSelector';
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../lib/auth';
import { useLanguage } from '../lib/LanguageContext';
import { spacing, radius, type ThemeColors } from '../lib/theme';
import type { RootStackNav } from '../types';

export default function LoginScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { t } = useLanguage();
  const { login, loginWithBiometric, isBiometricAvailable, biometricEnrolled } =
    useAuth();
  const navigation = useNavigation<RootStackNav>();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return;
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'network_error';
      const knownKeys = [
        'wrong_credentials',
        'account_locked',
        'network_error',
      ] as const;
      const key = knownKeys.find((k) => k === msg);
      setError(key ? t(key) : t('network_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleBiometric = async () => {
    setError('');
    setLoading(true);
    try {
      await loginWithBiometric();
    } catch (e) {
      const key = e instanceof Error ? e.message : 'network_error';
      if (key !== 'biometric_failed') setError(t(key as 'network_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={[colors.background, colors.surface, colors.background]}
      style={styles.gradient}
    >
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={insets.top}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View style={styles.logoSection}>
              <BrandLogo />
              <Text style={styles.tagline}>{t('splash_tagline')}</Text>
            </View>

            <View style={styles.card}>
              <LanguageSelector />
              <Text style={styles.cardTitle}>{t('log_in')}</Text>

              {error ? (
                <View style={styles.errorBox}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={16}
                    color={colors.error}
                  />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.field}>
                <Text style={styles.label}>{t('email')}</Text>
                <View style={styles.inputContainer}>
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color={colors.secondary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[styles.input, styles.iconInput]}
                    placeholder={t('email')}
                    placeholderTextColor={colors.gray400}
                    value={email}
                    accessibilityLabel={t('email')}
                    autoComplete="email"
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              <View style={styles.field}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>{t('password')}</Text>
                  <TouchableOpacity>
                    <Text style={styles.forgotLink}>
                      {t('forgot_password')}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.passwordWrapper}>
                  <View style={styles.inputContainer}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color={colors.secondary}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={[
                        styles.input,
                        styles.passwordInput,
                        styles.iconInput,
                      ]}
                      placeholder="••••••••"
                      placeholderTextColor={colors.gray400}
                      value={password}
                      accessibilityLabel={t('password')}
                      autoComplete="current-password"
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                    />
                  </View>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={t(
                      showPassword ? 'hide_password' : 'show_password',
                    )}
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeBtn}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={colors.gray500}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.loginBtn,
                  (!email.trim() || !password.trim() || loading) &&
                    styles.disabled,
                ]}
                onPress={handleLogin}
                disabled={!email.trim() || !password.trim() || loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color={colors.black} size="small" />
                ) : (
                  <Text style={styles.loginBtnText}>{t('log_in')}</Text>
                )}
              </TouchableOpacity>

              {isBiometricAvailable && biometricEnrolled && (
                <TouchableOpacity
                  style={styles.biometricBtn}
                  onPress={handleBiometric}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name="finger-print"
                    size={20}
                    color={colors.primary}
                  />
                  <Text style={styles.biometricText}>{t('face_id_login')}</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.signupRow}>
              <Text style={styles.signupHint}>{t('no_account')} </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                <Text style={styles.signupLink}>{t('sign_up_link')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    inputContainer: { position: 'relative' },
    inputIcon: { position: 'absolute', left: 16, top: 17, zIndex: 1 },
    iconInput: { paddingLeft: 48 },
    gradient: { flex: 1 },
    flex: { flex: 1 },
    scroll: { flexGrow: 1, paddingHorizontal: spacing.md },
    content: { width: '100%', maxWidth: 480, alignSelf: 'center' },
    logoSection: { alignItems: 'center', marginBottom: 40 },
    logoRing: {
      width: 80,
      height: 80,
      borderRadius: 40,
      borderWidth: 2,
      borderColor: `${colors.primary}40`,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    logoCore: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: `${colors.primary}20`,
      justifyContent: 'center',
      alignItems: 'center',
    },
    brandName: {
      fontSize: 32,
      fontWeight: '800',
      color: colors.onSurface,
      letterSpacing: -1,
    },
    tagline: { fontSize: 13, color: colors.gray500, marginTop: 4 },
    card: {
      backgroundColor: colors.cardBg,
      borderRadius: radius.xxl,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.gray200,
    },
    cardTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.onSurface,
      marginBottom: spacing.lg,
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: `${colors.error}20`,
      borderRadius: radius.md,
      padding: spacing.sm,
      marginBottom: spacing.md,
    },
    errorText: { color: colors.error, fontSize: 13, flex: 1 },
    field: { marginBottom: spacing.md },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.onSurface,
      marginBottom: 6,
    },
    labelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    forgotLink: { fontSize: 13, color: colors.secondary },
    input: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.md,
      fontSize: 15,
      color: colors.onSurface,
      borderWidth: 1,
      borderColor: colors.gray200,
    },
    passwordWrapper: { position: 'relative' },
    passwordInput: { paddingRight: 48 },
    eyeBtn: {
      position: 'absolute',
      right: 14,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
    },
    loginBtn: {
      backgroundColor: colors.primary,
      borderRadius: radius.full,
      padding: spacing.md,
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    disabled: { opacity: 0.5 },
    loginBtnText: { fontSize: 16, fontWeight: '700', color: colors.black },
    biometricBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: `${colors.primary}15`,
      borderRadius: radius.full,
      padding: spacing.md,
      marginTop: spacing.sm,
      borderWidth: 1,
      borderColor: `${colors.primary}30`,
    },
    biometricText: { fontSize: 15, fontWeight: '600', color: colors.primary },
    signupRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: spacing.lg,
    },
    signupHint: { color: colors.gray500, fontSize: 14 },
    signupLink: { color: colors.secondary, fontSize: 14, fontWeight: '600' },
  });
