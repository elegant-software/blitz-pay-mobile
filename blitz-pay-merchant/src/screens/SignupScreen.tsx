import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../lib/auth';
import { useLanguage } from '../lib/LanguageContext';
import { config } from '../lib/config';
import { colors, spacing, radius } from '../lib/theme';
import type { RootStackNav } from '../types';
import { readApiProblem } from '../lib/apiError';

type Vertical = { code: string; displayName: string };

function validatePassword(pw: string): boolean {
  return pw.length >= 8 && /[A-Z]/.test(pw) && /[0-9]/.test(pw);
}

export default function SignupScreen() {
  const { t } = useLanguage();
  const { login } = useAuth();
  const navigation = useNavigation<RootStackNav>();
  const insets = useSafeAreaInsets();

  const [ownerName, setOwnerName] = useState('');
  const [merchantName, setMerchantName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verticals, setVerticals] = useState<Vertical[]>([]);
  const [businessType, setBusinessType] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${config.apiUrl}/v1/merchants/verticals`)
      .then((res) => (res.ok ? res.json() : []))
      .then((list: Vertical[]) => {
        setVerticals(list);
        if (list.length > 0) setBusinessType(list[0].code);
      })
      .catch(() => {});
  }, []);

  const handleRegister = async () => {
    setError('');
    if (!ownerName.trim() || !merchantName.trim() || !email.trim() || !password.trim() || !confirmPassword.trim() || !businessType || !acceptedTerms) return;
    if (!validatePassword(password)) {
      setError(t('password_hint'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('passwords_do_not_match'));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${config.apiUrl}/v1/signup/merchant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerName: ownerName.trim(),
          merchantName: merchantName.trim(),
          email: email.trim(),
          password,
          businessType,
          acceptedTermsVersion: config.termsVersion,
        }),
      });

      if (!res.ok) {
        if ((await readApiProblem(res)).code === 'EMAIL_CONFLICT') throw new Error('email_conflict');
        throw new Error('registration_failed');
      }

      await login(email.trim(), password);
    } catch (e) {
      // fetch() rejects with a raw TypeError on network failure; map anything unknown to network_error.
      const msg = e instanceof Error ? e.message : '';
      const key = msg === 'email_conflict' || msg === 'registration_failed' ? msg : 'network_error';
      setError(t(key));
    } finally {
      setLoading(false);
    }
  };

  const canSubmit =
    ownerName.trim() && merchantName.trim() && email.trim() && businessType &&
    validatePassword(password) && password === confirmPassword && acceptedTerms;

  return (
    <LinearGradient colors={['#000000', '#0A0A1E', '#0D0D2B']} style={styles.gradient}>
      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={insets.top} style={styles.flex}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.white} />
          </TouchableOpacity>

          <View style={styles.header}>
            <Ionicons name="storefront" size={28} color={colors.primary} />
            <Text style={styles.title}>{t('create_account')}</Text>
          </View>

          <View style={styles.card}>
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.label}>{t('owner_name')}</Text>
              <TextInput
                style={styles.input}
                placeholder="Jane Doe"
                placeholderTextColor={colors.gray500}
                value={ownerName}
                onChangeText={setOwnerName}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('merchant_name')}</Text>
              <TextInput
                style={styles.input}
                placeholder="Jane's Café"
                placeholderTextColor={colors.gray500}
                value={merchantName}
                onChangeText={setMerchantName}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('business_type')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {verticals.map((v) => (
                  <TouchableOpacity
                    key={v.code}
                    style={[styles.chip, businessType === v.code && styles.chipActive]}
                    onPress={() => setBusinessType(v.code)}
                  >
                    <Text style={[styles.chipText, businessType === v.code && styles.chipTextActive]}>
                      {v.displayName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('email')}</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={colors.gray500}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('password')}</Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="••••••••"
                  placeholderTextColor={colors.gray500}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.gray500} />
                </TouchableOpacity>
              </View>
              <Text style={styles.hint}>{t('password_hint')}</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('confirm_password')}</Text>
              <TextInput
                style={[
                  styles.input,
                  confirmPassword && password !== confirmPassword && styles.inputError,
                ]}
                placeholder="••••••••"
                placeholderTextColor={colors.gray500}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
            </View>

            {/* GDPR Art. 7: an explicit, unticked-by-default acceptance; the backend stores the version. */}
            <View style={styles.consentRow}>
              <TouchableOpacity
                onPress={() => setAcceptedTerms(!acceptedTerms)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: acceptedTerms }}
                hitSlop={8}
              >
                <Ionicons name={acceptedTerms ? 'checkbox' : 'square-outline'} size={22} color={acceptedTerms ? colors.primary : colors.gray500} />
              </TouchableOpacity>
              <Text style={styles.consentText}>
                {t('signup_consent_prefix')}
                <Text style={styles.consentLink} onPress={() => Linking.openURL(config.termsUrl)}>{t('signup_consent_terms')}</Text>
                {t('signup_consent_and')}
                <Text style={styles.consentLink} onPress={() => Linking.openURL(config.privacyUrl)}>{t('signup_consent_privacy')}</Text>
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.registerBtn, (!canSubmit || loading) && styles.registerBtnDisabled]}
              onPress={handleRegister}
              disabled={!canSubmit || loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={colors.black} size="small" />
              ) : (
                <Text style={styles.registerBtnText}>{t('sign_up')}</Text>
              )}
            </TouchableOpacity>

            <View style={styles.loginRow}>
              <Text style={styles.loginHint}>{t('already_have_account')} </Text>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text style={styles.loginLink}>{t('log_in_link')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.md },
  consentText: { flex: 1, color: colors.gray400, fontSize: 13, lineHeight: 19 },
  consentLink: { color: colors.primary, textDecorationLine: 'underline' },
  gradient: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
  },
  backBtn: {
    marginBottom: spacing.md,
    width: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.white,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.xxl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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
    color: colors.gray300,
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: 15,
    color: colors.white,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  inputError: {
    borderColor: `${colors.error}80`,
  },
  chipRow: { flexDirection: 'row' },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginRight: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.gray300 },
  chipTextActive: { color: colors.black },
  passwordWrapper: { position: 'relative' },
  passwordInput: { paddingRight: 48 },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  hint: {
    fontSize: 12,
    color: colors.gray500,
    marginTop: 4,
  },
  registerBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  registerBtnDisabled: { opacity: 0.5 },
  registerBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.black,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  loginHint: { color: colors.gray500, fontSize: 14 },
  loginLink: { color: colors.primary, fontSize: 14, fontWeight: '600' },
});
