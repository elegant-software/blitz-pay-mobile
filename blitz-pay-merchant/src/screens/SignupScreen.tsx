import BrandLogo from '../components/BrandLogo';
import { useTheme } from '../lib/ThemeContext';
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
import { spacing, radius, type ThemeColors } from '../lib/theme';
import type { RootStackNav } from '../types';
import { readApiProblem } from '../lib/apiError';
import { useLegal } from '../lib/legal';

type Vertical = { code: string; displayName: string };

function validatePassword(pw: string): boolean {
  return pw.length >= 8 && /[A-Z]/.test(pw) && /[0-9]/.test(pw);
}

export default function SignupScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { t, language } = useLanguage();
  const { legal, reload: reloadLegal } = useLegal(language);
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
    if (
      !ownerName.trim() ||
      !merchantName.trim() ||
      !email.trim() ||
      !password.trim() ||
      !confirmPassword.trim() ||
      !businessType ||
      !acceptedTerms ||
      !legal
    )
      return;
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
          acceptedTermsVersion: legal.termsVersion,
        }),
      });

      if (!res.ok) {
        const { code } = await readApiProblem(res);
        if (code === 'EMAIL_CONFLICT') throw new Error('email_conflict');
        if (code === 'TERMS_OUTDATED') {
          // The text changed since this screen loaded: show the new links and ask again.
          setAcceptedTerms(false);
          reloadLegal();
          throw new Error('terms_outdated');
        }
        throw new Error('registration_failed');
      }

      await login(email.trim(), password);
    } catch (e) {
      // fetch() rejects with a raw TypeError on network failure; map anything unknown to network_error.
      const msg = e instanceof Error ? e.message : '';
      const known = [
        'email_conflict',
        'registration_failed',
        'terms_outdated',
      ] as const;
      const key = known.find((k) => k === msg) ?? 'network_error';
      setError(t(key));
    } finally {
      setLoading(false);
    }
  };

  const canSubmit =
    ownerName.trim() &&
    merchantName.trim() &&
    email.trim() &&
    businessType &&
    validatePassword(password) &&
    password === confirmPassword &&
    acceptedTerms &&
    legal;

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
            { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
          </TouchableOpacity>

          <View style={styles.header}>
            <BrandLogo />
            <Text style={styles.title}>{t('create_account')}</Text>
          </View>

          <View style={styles.card}>
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
              <Text style={styles.label}>{t('owner_name')}</Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="person-outline"
                  size={20}
                  color={colors.secondary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, styles.iconInput]}
                  placeholder={t('owner_name')}
                  placeholderTextColor={colors.gray500}
                  value={ownerName}
                  accessibilityLabel={t('owner_name')}
                  autoComplete="name"
                  onChangeText={setOwnerName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('merchant_name')}</Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="storefront-outline"
                  size={20}
                  color={colors.secondary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, styles.iconInput]}
                  placeholder={t('merchant_name')}
                  placeholderTextColor={colors.gray500}
                  value={merchantName}
                  accessibilityLabel={t('merchant_name')}
                  onChangeText={setMerchantName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('business_type')}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipRow}
              >
                {verticals.map((v) => (
                  <TouchableOpacity
                    key={v.code}
                    style={[
                      styles.chip,
                      businessType === v.code && styles.chipActive,
                    ]}
                    onPress={() => setBusinessType(v.code)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        businessType === v.code && styles.chipTextActive,
                      ]}
                    >
                      {v.displayName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

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
                  placeholderTextColor={colors.gray500}
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
              <Text style={styles.label}>{t('password')}</Text>
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
                    placeholderTextColor={colors.gray500}
                    value={password}
                    accessibilityLabel={t('password')}
                    autoComplete="new-password"
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
              <Text style={styles.hint}>{t('password_hint')}</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('confirm_password')}</Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={20}
                  color={colors.secondary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[
                    styles.input,
                    styles.iconInput,
                    confirmPassword &&
                      password !== confirmPassword &&
                      styles.inputError,
                  ]}
                  placeholder="••••••••"
                  placeholderTextColor={colors.gray500}
                  value={confirmPassword}
                  accessibilityLabel={t('confirm_password')}
                  autoComplete="new-password"
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* GDPR Art. 7: an explicit, unticked-by-default acceptance; the backend stores the version. */}
            {legal && (
              <View style={styles.consentRow}>
                <TouchableOpacity
                  onPress={() => setAcceptedTerms(!acceptedTerms)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: acceptedTerms }}
                  hitSlop={8}
                >
                  <Ionicons
                    name={acceptedTerms ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={acceptedTerms ? colors.primary : colors.gray500}
                  />
                </TouchableOpacity>
                <Text style={styles.consentText}>
                  {t('signup_consent_prefix')}
                  <Text
                    style={styles.consentLink}
                    onPress={() => Linking.openURL(legal.termsUrl)}
                  >
                    {t('signup_consent_terms')}
                  </Text>
                  {t('signup_consent_and')}
                  <Text
                    style={styles.consentLink}
                    onPress={() => Linking.openURL(legal.privacyUrl)}
                  >
                    {t('signup_consent_privacy')}
                  </Text>
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.registerBtn,
                (!canSubmit || loading) && styles.registerBtnDisabled,
              ]}
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

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    inputContainer: { position: 'relative' },
    inputIcon: { position: 'absolute', left: 16, top: 17, zIndex: 1 },
    iconInput: { paddingLeft: 48 },
    consentRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    consentText: {
      flex: 1,
      color: colors.gray400,
      fontSize: 13,
      lineHeight: 19,
    },
    consentLink: { color: colors.primary, textDecorationLine: 'underline' },
    gradient: { flex: 1 },
    flex: { flex: 1 },
    scroll: {
      flexGrow: 1,
      paddingHorizontal: spacing.md,
      width: '100%',
      maxWidth: 520,
      alignSelf: 'center',
    },
    backBtn: {
      marginBottom: spacing.md,
      width: 40,
    },
    header: {
      alignItems: 'center',
      gap: 24,
      marginBottom: spacing.lg,
    },
    title: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.onSurface,
    },
    card: {
      backgroundColor: colors.cardBg,
      borderRadius: radius.xxl,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.gray200,
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
    input: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.md,
      fontSize: 15,
      color: colors.onSurface,
      borderWidth: 1,
      borderColor: colors.gray200,
    },
    inputError: {
      borderColor: `${colors.error}80`,
    },
    chipRow: { flexDirection: 'row' },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.gray200,
      marginRight: spacing.sm,
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: { fontSize: 13, fontWeight: '600', color: colors.onSurface },
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
