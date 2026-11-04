import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/auth';
import { useLanguage } from '../lib/LanguageContext';
import { colors, spacing, radius, shadow } from '../lib/theme';
import type { RootStackNav } from '../types';
import {
  fetchAppointmentPolicy,
  patchAppointmentPolicy,
  type AppointmentPolicy,
} from '../features/appointments/services/employeeService';

export default function AppointmentPolicyScreen() {
  const { t } = useLanguage();
  const { activeBranchScope } = useAuth();
  const navigation = useNavigation<RootStackNav>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const merchantId = activeBranchScope?.merchantId ?? null;

  const [interval, setInterval] = useState('');
  const [leadTime, setLeadTime] = useState('');
  const [horizon, setHorizon] = useState('');
  const [reminder, setReminder] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: merchantId ? ['appointment_policy', merchantId] : ['appointment_policy', 'missing'],
    queryFn: () => fetchAppointmentPolicy(merchantId!),
    enabled: !!merchantId,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (data && !loaded) {
      setInterval(String(data.bookingIntervalMinutes));
      setLeadTime(String(data.bookingLeadTimeMinutes));
      setHorizon(String(data.bookingHorizonDays));
      setReminder(String(data.reminderLeadTimeMinutes));
      setLoaded(true);
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveMutation = useMutation({
    mutationFn: () => {
      const patch: Partial<AppointmentPolicy> = {};
      const intVal = parseInt(interval, 10);
      const ltVal = parseInt(leadTime, 10);
      const hzVal = parseInt(horizon, 10);
      const rmVal = parseInt(reminder, 10);
      if (!isNaN(intVal)) patch.bookingIntervalMinutes = intVal;
      if (!isNaN(ltVal)) patch.bookingLeadTimeMinutes = ltVal;
      if (!isNaN(hzVal)) patch.bookingHorizonDays = hzVal;
      if (!isNaN(rmVal)) patch.reminderLeadTimeMinutes = rmVal;
      return patchAppointmentPolicy(merchantId!, patch);
    },
    onSuccess: (updated) => {
      setSaveError(null);
      setSaved(true);
      setLoaded(false); // allow re-seed from new data
      void queryClient.invalidateQueries({ queryKey: ['appointment_policy', merchantId] });
      // Re-seed from returned value immediately
      setInterval(String(updated.bookingIntervalMinutes));
      setLeadTime(String(updated.bookingLeadTimeMinutes));
      setHorizon(String(updated.bookingHorizonDays));
      setReminder(String(updated.reminderLeadTimeMinutes));
      setLoaded(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: () => setSaveError(t('appointment_policy_save_failed')),
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
    >
      <View style={[styles.safeTop, { paddingTop: insets.top }]} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('appointment_policy_title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerText}>{t('appointment_policy_loading')}</Text>
        </View>
      ) : error || !merchantId ? (
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={styles.centerTitle}>{t('error')}</Text>
          <Text style={styles.centerText}>{t('appointment_policy_load_failed')}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void refetch()}>
            <Text style={styles.retryBtnText}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + 80 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {saved ? (
            <View style={styles.successBanner}>
              <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
              <Text style={styles.successBannerText}>{t('appointment_policy_saved')}</Text>
            </View>
          ) : null}
          {saveError ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
              <Text style={styles.errorBannerText}>{saveError}</Text>
            </View>
          ) : null}

          <PolicyField
            label={t('appointment_policy_booking_interval')}
            value={interval}
            onChange={setInterval}
            hint="e.g. 15 (minutes between available slots)"
          />
          <PolicyField
            label={t('appointment_policy_lead_time')}
            value={leadTime}
            onChange={setLeadTime}
            hint="Minimum advance booking time in minutes"
          />
          <PolicyField
            label={t('appointment_policy_horizon')}
            value={horizon}
            onChange={setHorizon}
            hint="How many days in advance can be booked"
          />
          <PolicyField
            label={t('appointment_policy_reminder')}
            value={reminder}
            onChange={setReminder}
            hint="Minutes before the appointment to send a reminder"
          />
        </ScrollView>
      )}

      {!isLoading && !error && merchantId ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <TouchableOpacity
            style={[styles.saveBtn, saveMutation.isPending && styles.btnDisabled]}
            onPress={() => void saveMutation.mutateAsync()}
            disabled={saveMutation.isPending}
            activeOpacity={0.85}
          >
            {saveMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Ionicons name="save-outline" size={18} color={colors.onPrimary} />
            )}
            <Text style={styles.saveBtnText}>
              {saveMutation.isPending ? t('appointment_policy_saving') : t('appointment_policy_save')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

function PolicyField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <View style={fieldStyles.container}>
      <Text style={fieldStyles.label}>{label}</Text>
      <View style={[fieldStyles.inputWrap, shadow.sm]}>
        <TextInput
          style={fieldStyles.input}
          value={value}
          onChangeText={onChange}
          keyboardType="number-pad"
          returnKeyType="done"
          placeholderTextColor={colors.gray400}
          placeholder="0"
        />
      </View>
      {hint ? <Text style={fieldStyles.hint}>{hint}</Text> : null}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  container: { gap: 4 },
  label: { fontSize: 13, fontWeight: '600', color: colors.gray700 },
  inputWrap: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  input: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.onSurface,
  },
  hint: { fontSize: 12, color: colors.gray500, marginTop: 2 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  safeTop: { backgroundColor: colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface },
  form: { padding: spacing.md, gap: spacing.md },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  centerTitle: { fontSize: 16, fontWeight: '700', color: colors.onSurface },
  centerText: { fontSize: 14, color: colors.gray600, textAlign: 'center' },
  retryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryBtnText: { color: colors.onPrimary, fontWeight: '700' },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: `${colors.success}10`,
    borderRadius: radius.lg,
    padding: spacing.sm,
  },
  successBannerText: { flex: 1, fontSize: 13, color: colors.success, fontWeight: '600' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: `${colors.error}10`,
    borderRadius: radius.lg,
    padding: spacing.sm,
  },
  errorBannerText: { flex: 1, fontSize: 13, color: colors.onSurface },
  footer: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
  },
  btnDisabled: { opacity: 0.55 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: colors.onPrimary },
});
