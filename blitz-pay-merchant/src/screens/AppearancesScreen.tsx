import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../lib/auth';
import { useLanguage } from '../lib/LanguageContext';
import { observability } from '../lib/observability';
import {
  cancelMerchantAppearance,
  createMerchantAppearance,
  listMerchantAppearances,
  MerchantAppearanceError,
  type MerchantAppearance,
} from '../lib/merchantAppearances';
import { colors, radius, shadow, spacing } from '../lib/theme';
import type { RootStackNav } from '../types';

type AppearanceForm = {
  name: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  latitude: string;
  longitude: string;
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatTimeInput(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildInitialForm(latitude?: number, longitude?: number): AppearanceForm {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  return {
    name: '',
    startDate: formatDateInput(start),
    startTime: formatTimeInput(start),
    endDate: formatDateInput(end),
    endTime: formatTimeInput(end),
    latitude: latitude != null ? String(latitude) : '',
    longitude: longitude != null ? String(longitude) : '',
  };
}

function toIsoString(date: string, time: string): string | null {
  const parsed = new Date(`${date}T${time}:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function formatAppearanceWindow(startTime: string, endTime: string, locale: string): string {
  const formatter = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${formatter.format(new Date(startTime))} - ${formatter.format(new Date(endTime))}`;
}

function AppearanceCard({
  appearance,
  locale,
  cancelLabel,
  onCancel,
}: {
  appearance: MerchantAppearance;
  locale: string;
  cancelLabel: string;
  onCancel: (appearance: MerchantAppearance) => void;
}) {
  return (
    <View style={[styles.appearanceCard, shadow.sm]}>
      <View style={styles.appearanceHeader}>
        <View style={styles.appearanceTitleWrap}>
          <Text style={styles.appearanceTitle}>{appearance.name}</Text>
          <Text style={styles.appearanceSubtitle}>
            {formatAppearanceWindow(appearance.startTime, appearance.endTime, locale)}
          </Text>
        </View>
        <TouchableOpacity style={styles.cancelPill} onPress={() => onCancel(appearance)}>
          <Text style={styles.cancelPillText}>{cancelLabel}</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.appearanceMeta}>
        {appearance.declaredLatitude.toFixed(5)}, {appearance.declaredLongitude.toFixed(5)}
      </Text>
    </View>
  );
}

export default function AppearancesScreen() {
  const { language, t } = useLanguage();
  const { activeBranchScope, branchScopeError, retryBranchScope } = useAuth();
  const navigation = useNavigation<RootStackNav>();
  const insets = useSafeAreaInsets();
  const [appearances, setAppearances] = useState<MerchantAppearance[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErrorKey, setLoadErrorKey] = useState<string | null>(null);
  const [submitErrorKey, setSubmitErrorKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [form, setForm] = useState<AppearanceForm>(buildInitialForm(
    activeBranchScope?.latitude,
    activeBranchScope?.longitude,
  ));

  useEffect(() => {
    setForm((current) => ({
      ...current,
      latitude: current.latitude || (activeBranchScope?.latitude != null ? String(activeBranchScope.latitude) : ''),
      longitude: current.longitude || (activeBranchScope?.longitude != null ? String(activeBranchScope.longitude) : ''),
    }));
  }, [activeBranchScope?.latitude, activeBranchScope?.longitude]);

  const loadAppearances = useCallback(async () => {
    if (!activeBranchScope) {
      observability.warn('merchant_appearances_scope_missing', {
        branchScopeError: branchScopeError ?? 'merchant_branch_access_missing',
      });
      setAppearances([]);
      setLoadErrorKey(branchScopeError ?? 'merchant_branch_access_missing');
      setLoading(false);
      return;
    }

    observability.info('merchant_appearances_scope_resolved', {
      merchantId: activeBranchScope.merchantId,
      branchId: activeBranchScope.branchId,
      branchName: activeBranchScope.branchName ?? null,
      branchStatus: activeBranchScope.branchStatus ?? null,
    });
    setLoading(true);
    setLoadErrorKey(null);

    try {
      const rows = await listMerchantAppearances(activeBranchScope.merchantId, activeBranchScope.branchId);
      observability.info('merchant_appearances_screen_load_succeeded', {
        merchantId: activeBranchScope.merchantId,
        branchId: activeBranchScope.branchId,
        count: rows.length,
      });
      setAppearances(rows);
      setLoading(false);
    } catch (error) {
      observability.error('merchant_appearances_screen_load_failed', {
        merchantId: activeBranchScope.merchantId,
        branchId: activeBranchScope.branchId,
        reason: error instanceof Error ? error.message : 'unknown_error',
        errorKey: error instanceof MerchantAppearanceError ? error.key : 'merchant_appearances_load_failed',
        status: error instanceof MerchantAppearanceError ? error.status ?? null : null,
      });
      setAppearances([]);
      setLoadErrorKey(error instanceof MerchantAppearanceError ? error.key : 'merchant_appearances_load_failed');
      setLoading(false);
    }
  }, [activeBranchScope, branchScopeError]);

  useFocusEffect(
    useCallback(() => {
      void loadAppearances();
    }, [loadAppearances]),
  );

  const now = Date.now();
  const activeItems = useMemo(
    () => appearances.filter((appearance) => {
      const start = new Date(appearance.startTime).getTime();
      const end = new Date(appearance.endTime).getTime();
      return start <= now && end > now;
    }),
    [appearances, now],
  );
  const upcomingItems = useMemo(
    () => appearances.filter((appearance) => new Date(appearance.startTime).getTime() > now),
    [appearances, now],
  );

  const submit = async () => {
    if (!activeBranchScope) {
      observability.warn('merchant_appearance_create_scope_missing', {
        branchScopeError: branchScopeError ?? 'merchant_branch_access_missing',
      });
      setSubmitErrorKey(branchScopeError ?? 'merchant_branch_access_missing');
      return;
    }

    const startTime = toIsoString(form.startDate, form.startTime);
    const endTime = toIsoString(form.endDate, form.endTime);
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);

    if (
      !form.name.trim()
      || !startTime
      || !endTime
      || !Number.isFinite(latitude)
      || !Number.isFinite(longitude)
      || new Date(endTime).getTime() <= new Date(startTime).getTime()
    ) {
      setSubmitErrorKey('merchant_appearance_validation_failed');
      return;
    }

    setSaving(true);
    setSubmitErrorKey(null);
    try {
      observability.info('merchant_appearance_create_attempted', {
        merchantId: activeBranchScope.merchantId,
        branchId: activeBranchScope.branchId,
        startTime,
        endTime,
      });
      await createMerchantAppearance({
        merchantId: activeBranchScope.merchantId,
        branchId: activeBranchScope.branchId,
        name: form.name.trim(),
        declaredLatitude: latitude,
        declaredLongitude: longitude,
        startTime,
        endTime,
      });
      setForm(buildInitialForm(activeBranchScope.latitude, activeBranchScope.longitude));
      await loadAppearances();
    } catch (error) {
      observability.error('merchant_appearance_create_screen_failed', {
        merchantId: activeBranchScope.merchantId,
        branchId: activeBranchScope.branchId,
        reason: error instanceof Error ? error.message : 'unknown_error',
        errorKey: error instanceof MerchantAppearanceError ? error.key : 'merchant_appearance_create_failed',
        status: error instanceof MerchantAppearanceError ? error.status ?? null : null,
      });
      setSubmitErrorKey(error instanceof MerchantAppearanceError ? error.key : 'merchant_appearance_create_failed');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = (appearance: MerchantAppearance) => {
    if (!activeBranchScope) return;

    Alert.alert(
      t('merchant_appearance_cancel_title'),
      t('merchant_appearance_cancel_body'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('confirm'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setCancellingId(appearance.appearanceId);
              try {
                await cancelMerchantAppearance(
                  activeBranchScope.merchantId,
                  activeBranchScope.branchId,
                  appearance.appearanceId,
                );
                await loadAppearances();
              } catch (error) {
                setLoadErrorKey(error instanceof MerchantAppearanceError ? error.key : 'merchant_appearance_cancel_failed');
              } finally {
                setCancellingId(null);
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior="padding"
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>{t('merchant_appearances')}</Text>
          <Text style={styles.subtitle}>
            {activeBranchScope?.branchId
              ? `${t('merchant_branch_scope_authorized')}: ${activeBranchScope.branchName ?? ''}`
              : t('merchant_branch_scope_pending')}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: 100 + insets.bottom, paddingTop: spacing.md }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.formCard, shadow.sm]}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>{t('merchant_appearance_create_title')}</Text>
            <Text style={styles.formSubtitle}>{t('merchant_appearance_create_body')}</Text>
          </View>

          <TextInput
            style={styles.input}
            value={form.name}
            onChangeText={(value) => setForm((current) => ({ ...current, name: value }))}
            placeholder={t('merchant_appearance_name')}
            placeholderTextColor={colors.gray400}
          />

          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.halfInput]}
              value={form.startDate}
              onChangeText={(value) => setForm((current) => ({ ...current, startDate: value }))}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.gray400}
            />
            <TextInput
              style={[styles.input, styles.halfInput]}
              value={form.startTime}
              onChangeText={(value) => setForm((current) => ({ ...current, startTime: value }))}
              placeholder="HH:MM"
              placeholderTextColor={colors.gray400}
            />
          </View>

          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.halfInput]}
              value={form.endDate}
              onChangeText={(value) => setForm((current) => ({ ...current, endDate: value }))}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.gray400}
            />
            <TextInput
              style={[styles.input, styles.halfInput]}
              value={form.endTime}
              onChangeText={(value) => setForm((current) => ({ ...current, endTime: value }))}
              placeholder="HH:MM"
              placeholderTextColor={colors.gray400}
            />
          </View>

          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.halfInput]}
              value={form.latitude}
              onChangeText={(value) => setForm((current) => ({ ...current, latitude: value }))}
              placeholder={t('merchant_appearance_latitude')}
              placeholderTextColor={colors.gray400}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={[styles.input, styles.halfInput]}
              value={form.longitude}
              onChangeText={(value) => setForm((current) => ({ ...current, longitude: value }))}
              placeholder={t('merchant_appearance_longitude')}
              placeholderTextColor={colors.gray400}
              keyboardType="decimal-pad"
            />
          </View>

          {submitErrorKey ? <Text style={styles.errorText}>{t(submitErrorKey as Parameters<typeof t>[0])}</Text> : null}

          <TouchableOpacity style={styles.primaryButton} onPress={() => void submit()} disabled={saving}>
            {saving ? <ActivityIndicator color={colors.black} /> : <Text style={styles.primaryButtonText}>{t('merchant_appearance_create_cta')}</Text>}
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={[styles.stateCard, shadow.sm]}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateTitle}>{t('merchant_appearances_loading')}</Text>
          </View>
        ) : loadErrorKey ? (
          <View style={[styles.stateCard, shadow.sm]}>
            <Ionicons name="alert-circle-outline" size={24} color={colors.error} />
            <Text style={styles.stateTitle}>{t(loadErrorKey as Parameters<typeof t>[0])}</Text>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => void (branchScopeError ? retryBranchScope() : loadAppearances())}
            >
              <Text style={styles.secondaryButtonText}>{t('retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('merchant_appearance_active')}</Text>
              {activeItems.length === 0 ? (
                <View style={[styles.stateCard, shadow.sm]}>
                  <Ionicons name="radio-outline" size={24} color={colors.gray500} />
                  <Text style={styles.stateTitle}>{t('merchant_appearance_active_empty')}</Text>
                </View>
              ) : (
                activeItems.map((appearance) => (
                  <View key={appearance.appearanceId} style={cancellingId === appearance.appearanceId ? styles.dimmed : undefined}>
                    <AppearanceCard
                      appearance={appearance}
                      locale={language === 'de' ? 'de-DE' : 'en-US'}
                      cancelLabel={t('cancel')}
                      onCancel={handleCancel}
                    />
                  </View>
                ))
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('merchant_appearance_upcoming')}</Text>
              {upcomingItems.length === 0 ? (
                <View style={[styles.stateCard, shadow.sm]}>
                  <Ionicons name="calendar-outline" size={24} color={colors.gray500} />
                  <Text style={styles.stateTitle}>{t('merchant_appearance_upcoming_empty')}</Text>
                </View>
              ) : (
                upcomingItems.map((appearance) => (
                  <View key={appearance.appearanceId} style={cancellingId === appearance.appearanceId ? styles.dimmed : undefined}>
                    <AppearanceCard
                      appearance={appearance}
                      locale={language === 'de' ? 'de-DE' : 'en-US'}
                      cancelLabel={t('cancel')}
                      onCancel={handleCancel}
                    />
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  headerContent: { flex: 1 },
  title: { fontSize: 24, fontWeight: '800', color: colors.onSurface },
  subtitle: { marginTop: 2, fontSize: 12, color: colors.gray600 },
  formCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.sm,
  },
  formHeader: { marginBottom: spacing.xs },
  formTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface },
  formSubtitle: { marginTop: 2, fontSize: 12, color: colors.gray600 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 14,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  halfInput: { flex: 1 },
  errorText: { fontSize: 12, color: colors.error, fontWeight: '600' },
  primaryButton: {
    marginTop: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  primaryButtonText: { fontSize: 14, fontWeight: '700', color: colors.black },
  section: { marginTop: spacing.lg, gap: spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.onSurface },
  appearanceCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  appearanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  appearanceTitleWrap: { flex: 1 },
  appearanceTitle: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  appearanceSubtitle: { marginTop: 4, fontSize: 12, color: colors.gray600 },
  appearanceMeta: { marginTop: spacing.sm, fontSize: 12, color: colors.gray500 },
  cancelPill: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: `${colors.error}12`,
  },
  cancelPillText: { fontSize: 12, fontWeight: '700', color: colors.error },
  stateCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  stateTitle: { fontSize: 15, fontWeight: '600', color: colors.onSurface, textAlign: 'center' },
  secondaryButton: {
    marginTop: spacing.xs,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
  },
  secondaryButtonText: { fontSize: 14, fontWeight: '700', color: colors.black },
  dimmed: { opacity: 0.5 },
});
