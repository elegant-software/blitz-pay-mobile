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
import { useMerchantSignup } from '../features/auth/hooks/useMerchantSignup';
import BusinessTypeAutocomplete from '../features/auth/components/BusinessTypeAutocomplete';
import { colors, spacing, radius } from '../lib/theme';
import type { RootStackNav } from '../types';

export default function SignupScreen() {
  const { t } = useLanguage();
  const { login } = useAuth();
  const navigation = useNavigation<RootStackNav>();
  const insets = useSafeAreaInsets();

  const [showPassword, setShowPassword] = useState(false);
  const {fields, setField, verticals, verticalsLoading, verticalsError, retryVerticals,
    loading, error, notice, canSubmit, handleRegister} = useMerchantSignup(login, t);
  const {ownerName, merchantName, email, password, confirmPassword, businessType, operatingCountry} = fields;

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
            <View style={styles.headerIcon}><Ionicons name="storefront-outline" size={24} color={colors.primary} /></View>
            <View style={styles.headerCopy}>
              <Text accessibilityRole="header" style={styles.title}>{t('create_account')}</Text>
              <Text style={styles.subtitle}>{t('registration_subtitle')}</Text>
            </View>
          </View>

          <View style={styles.card}>
            {notice ? <View style={styles.noticeBox} accessibilityRole="alert"><Text style={styles.noticeText}>{notice}</Text></View> : null}
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
                onChangeText={(value) => setField('ownerName', value)}
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
                onChangeText={(value) => setField('merchantName', value)}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('registration_operating_country')}</Text>
              <TextInput style={styles.input} value={operatingCountry} maxLength={2} autoCapitalize="characters"
                onChangeText={(value) => setField('operatingCountry', value.toUpperCase())} placeholder="DE" placeholderTextColor={colors.gray500}/>
              <Text style={styles.hint}>{t('registration_country_hint')}</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('registration_business_type')}</Text>
              {verticalsError ? <View accessibilityRole="alert"><Text style={styles.errorText}>{verticalsError}</Text>
                <TouchableOpacity onPress={() => void retryVerticals()}><Text style={styles.loginLink}>{t('registration_retry')}</Text></TouchableOpacity></View> : null}
              {!verticalsError ? <BusinessTypeAutocomplete options={verticals} value={businessType} loading={verticalsLoading}
                onChange={code => setField('businessType', code)}/> : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('email')}</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={colors.gray500}
                value={email}
                onChangeText={(value) => setField('email', value)}
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
                  onChangeText={(value) => setField('password', value)}
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
                onChangeText={(value) => setField('confirmPassword', value)}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
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
  noticeBox: {padding: spacing.md, marginBottom: spacing.md, backgroundColor: 'rgba(0,194,255,0.12)', borderRadius: radius.md},
  noticeText: {color: colors.primary, fontSize: 14, lineHeight: 20},
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 25,
    lineHeight: 32,
    fontWeight: '800',
    color: colors.white,
  },
  headerIcon: {width: 48, height: 48, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,194,255,0.12)'},
  headerCopy: {flex: 1, minWidth: 0},
  subtitle: {fontSize: 14, lineHeight: 21, color: colors.gray300, marginTop: spacing.xs},
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
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  loginHint: { color: colors.gray500, fontSize: 14 },
  loginLink: { color: colors.primary, fontSize: 14, fontWeight: '600' },
});
