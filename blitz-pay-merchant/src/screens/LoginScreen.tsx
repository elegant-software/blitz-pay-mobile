import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../lib/auth';
import { useLanguage } from '../lib/LanguageContext';
import { colors, spacing, radius } from '../lib/theme';
import { config } from '../lib/config';

export default function LoginScreen() {
  const { t } = useLanguage();
  const { login, loginWithBiometric, isBiometricAvailable, biometricEnrolled } = useAuth();
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
      const knownKeys = ['wrong_credentials', 'account_locked', 'network_error'] as const;
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
    <LinearGradient colors={['#000000', '#0A0A1E', '#0D0D2B']} style={styles.gradient}>
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={insets.top}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View style={styles.logoSection}>
              <View style={styles.logoRing}>
                <View style={styles.logoCore}>
                  <Ionicons name="storefront" size={32} color={colors.primary} />
                </View>
              </View>
              <Text style={styles.brandName}>BlitzPay</Text>
              <Text style={styles.tagline}>{t('splash_tagline')}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('log_in')}</Text>

              {error ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.field}>
                <Text style={styles.label}>{t('email')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="merchant@example.com"
                  placeholderTextColor={colors.gray400}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.field}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>{t('password')}</Text>
                  <TouchableOpacity>
                    <Text style={styles.forgotLink}>{t('forgot_password')}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.passwordWrapper}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    placeholder="••••••••"
                    placeholderTextColor={colors.gray400}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.gray500} />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.loginBtn, (!email.trim() || !password.trim() || loading) && styles.disabled]}
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
                <TouchableOpacity style={styles.biometricBtn} onPress={handleBiometric} activeOpacity={0.85}>
                  <Ionicons name="finger-print" size={20} color={colors.primary} />
                  <Text style={styles.biometricText}>{t('face_id_login')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {__DEV__ && (
            <View style={styles.devNote}>
              <Text style={styles.devNoteText}>
                Auth bypass: {String(config.authBypass)} · {config.keycloakUrl}
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.md },
  content: { width: '100%' },
  logoSection: { alignItems: 'center', marginBottom: 40 },
  logoRing: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 2, borderColor: `${colors.primary}40`,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  logoCore: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: `${colors.primary}20`,
    justifyContent: 'center', alignItems: 'center',
  },
  brandName: { fontSize: 32, fontWeight: '800', color: colors.white, letterSpacing: -1 },
  tagline: { fontSize: 13, color: colors.gray500, marginTop: 4 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.xxl, padding: spacing.lg,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  cardTitle: { fontSize: 22, fontWeight: '700', color: colors.white, marginBottom: spacing.lg },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: `${colors.error}20`, borderRadius: radius.md,
    padding: spacing.sm, marginBottom: spacing.md,
  },
  errorText: { color: colors.error, fontSize: 13, flex: 1 },
  field: { marginBottom: spacing.md },
  label: { fontSize: 13, fontWeight: '600', color: colors.gray300, marginBottom: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  forgotLink: { fontSize: 13, color: colors.primary },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radius.lg,
    padding: spacing.md, fontSize: 15, color: colors.white,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  passwordWrapper: { position: 'relative' },
  passwordInput: { paddingRight: 48 },
  eyeBtn: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  loginBtn: {
    backgroundColor: colors.primary, borderRadius: radius.full,
    padding: spacing.md, alignItems: 'center', marginTop: spacing.sm,
  },
  disabled: { opacity: 0.5 },
  loginBtnText: { fontSize: 16, fontWeight: '700', color: colors.black },
  biometricBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: `${colors.primary}15`, borderRadius: radius.full,
    padding: spacing.md, marginTop: spacing.sm,
    borderWidth: 1, borderColor: `${colors.primary}30`,
  },
  biometricText: { fontSize: 15, fontWeight: '600', color: colors.primary },
  devNote: { marginTop: 16, alignItems: 'center' },
  devNoteText: { fontSize: 11, color: colors.gray600 },
});
