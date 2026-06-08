import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/auth';
import { useLanguage } from '../lib/LanguageContext';
import { colors, spacing, radius, shadow } from '../lib/theme';
import type { RootStackParamList, RootStackNav } from '../types';
import {
  fetchEmployeeBranchAssignments,
  addEmployeeBranchAssignment,
  removeEmployeeBranchAssignment,
  fetchEmployeeServiceAssignments,
  addEmployeeServiceAssignment,
  removeEmployeeServiceAssignment,
  fetchWeeklyAvailability,
  setWeeklyAvailability,
  fetchAvailabilityExceptions,
  addAvailabilityException,
  removeAvailabilityException,
  type WeeklyAvailabilitySlot,
  type AvailabilityException,
} from '../features/appointments/services/employeeService';

type RouteProps = RouteProp<RootStackParamList, 'EmployeeDetail'>;

const DAYS_OF_WEEK: WeeklyAvailabilitySlot['dayOfWeek'][] = [
  'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY',
];
const DAY_LABELS: Record<WeeklyAvailabilitySlot['dayOfWeek'], string> = {
  MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed', THURSDAY: 'Thu',
  FRIDAY: 'Fri', SATURDAY: 'Sat', SUNDAY: 'Sun',
};

export default function EmployeeDetailScreen() {
  const { t } = useLanguage();
  const { activeBranchScope } = useAuth();
  const navigation = useNavigation<RootStackNav>();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { employeeId, merchantId, employeeName } = route.params;

  const branchId = activeBranchScope?.branchId ?? null;

  // ─── Branch Assignments ─────────────────────────────────────────────────────
  const [newBranchId, setNewBranchId] = useState('');
  const [branchError, setBranchError] = useState<string | null>(null);

  const branchAssignments = useQuery({
    queryKey: ['employee_branch_assignments', merchantId, employeeId],
    queryFn: () => fetchEmployeeBranchAssignments(merchantId, employeeId),
    staleTime: 30_000,
  });

  const addBranchMutation = useMutation({
    mutationFn: () => addEmployeeBranchAssignment(merchantId, employeeId, newBranchId.trim()),
    onSuccess: () => {
      setNewBranchId('');
      setBranchError(null);
      void queryClient.invalidateQueries({ queryKey: ['employee_branch_assignments', merchantId, employeeId] });
    },
    onError: (e: Error) => setBranchError(e.message || t('employee_detail_save_failed')),
  });

  const removeBranchMutation = useMutation({
    mutationFn: (bId: string) => removeEmployeeBranchAssignment(merchantId, employeeId, bId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['employee_branch_assignments', merchantId, employeeId] }),
  });

  // ─── Service Assignments ────────────────────────────────────────────────────
  const [newProductId, setNewProductId] = useState('');
  const [serviceError, setServiceError] = useState<string | null>(null);

  const serviceAssignments = useQuery({
    queryKey: ['employee_service_assignments', merchantId, employeeId],
    queryFn: () => fetchEmployeeServiceAssignments(merchantId, employeeId),
    staleTime: 30_000,
  });

  const addServiceMutation = useMutation({
    mutationFn: () => addEmployeeServiceAssignment(merchantId, employeeId, newProductId.trim()),
    onSuccess: () => {
      setNewProductId('');
      setServiceError(null);
      void queryClient.invalidateQueries({ queryKey: ['employee_service_assignments', merchantId, employeeId] });
    },
    onError: (e: Error) => setServiceError(e.message || t('employee_detail_save_failed')),
  });

  const removeServiceMutation = useMutation({
    mutationFn: (pId: string) => removeEmployeeServiceAssignment(merchantId, employeeId, pId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['employee_service_assignments', merchantId, employeeId] }),
  });

  // ─── Weekly Availability ────────────────────────────────────────────────────
  const [localSlots, setLocalSlots] = useState<WeeklyAvailabilitySlot[]>([]);
  const [availabilityLoaded, setAvailabilityLoaded] = useState(false);
  const [availError, setAvailError] = useState<string | null>(null);

  const weeklyAvailability = useQuery({
    queryKey: ['employee_availability', merchantId, employeeId, branchId],
    queryFn: () => fetchWeeklyAvailability(merchantId, employeeId, branchId!),
    enabled: !!branchId,
    staleTime: 60_000,
    select: (data) => data,
  });

  React.useEffect(() => {
    if (weeklyAvailability.data && !availabilityLoaded) {
      setLocalSlots(weeklyAvailability.data);
      setAvailabilityLoaded(true);
    }
  }, [weeklyAvailability.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveAvailabilityMutation = useMutation({
    mutationFn: () => setWeeklyAvailability(merchantId, employeeId, branchId!, localSlots),
    onSuccess: () => {
      setAvailError(null);
      void queryClient.invalidateQueries({
        queryKey: ['employee_availability', merchantId, employeeId, branchId],
      });
    },
    onError: () => setAvailError(t('employee_detail_save_failed')),
  });

  function addAvailabilitySlot() {
    setLocalSlots((prev) => [
      ...prev,
      { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '17:00' },
    ]);
  }

  function removeAvailabilitySlot(index: number) {
    setLocalSlots((prev) => prev.filter((_, i) => i !== index));
  }

  function updateSlot(index: number, field: keyof WeeklyAvailabilitySlot, value: string) {
    setLocalSlots((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    );
  }

  // ─── Exceptions ─────────────────────────────────────────────────────────────
  const [exceptionDate, setExceptionDate] = useState('');
  const [exceptionUnavailable, setExceptionUnavailable] = useState(true);
  const [exceptionStart, setExceptionStart] = useState('');
  const [exceptionEnd, setExceptionEnd] = useState('');
  const [exceptionError, setExceptionError] = useState<string | null>(null);

  const exceptions = useQuery({
    queryKey: ['employee_exceptions', merchantId, employeeId, branchId],
    queryFn: () => fetchAvailabilityExceptions(merchantId, employeeId, branchId!),
    enabled: !!branchId,
    staleTime: 60_000,
  });

  const addExceptionMutation = useMutation({
    mutationFn: () =>
      addAvailabilityException(merchantId, employeeId, branchId!, {
        date: exceptionDate.trim(),
        unavailable: exceptionUnavailable,
        startTime: !exceptionUnavailable && exceptionStart.trim() ? exceptionStart.trim() : null,
        endTime: !exceptionUnavailable && exceptionEnd.trim() ? exceptionEnd.trim() : null,
      }),
    onSuccess: () => {
      setExceptionDate('');
      setExceptionUnavailable(true);
      setExceptionStart('');
      setExceptionEnd('');
      setExceptionError(null);
      void queryClient.invalidateQueries({
        queryKey: ['employee_exceptions', merchantId, employeeId, branchId],
      });
    },
    onError: (e: Error) => setExceptionError(e.message || t('employee_detail_save_failed')),
  });

  const removeExceptionMutation = useMutation({
    mutationFn: (exId: string) =>
      removeAvailabilityException(merchantId, employeeId, branchId!, exId),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: ['employee_exceptions', merchantId, employeeId, branchId],
      }),
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{employeeName}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 + insets.bottom, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Branch Assignments ───────────────────────────────────────────── */}
        <Section title={t('employee_detail_branch_assignments')}>
          {branchAssignments.isLoading ? (
            <LoadingRow label={t('employee_detail_assignments_loading')} />
          ) : branchAssignments.error ? (
            <ErrorText text={t('employee_detail_assignments_load_failed')} />
          ) : branchAssignments.data && branchAssignments.data.length === 0 ? (
            <EmptyText text={t('employee_detail_no_branches')} />
          ) : (
            (branchAssignments.data ?? []).map((ba) => (
              <AssignmentRow
                key={ba.branchId}
                label={ba.branchId}
                onRemove={() => void removeBranchMutation.mutateAsync(ba.branchId)}
                removing={removeBranchMutation.isPending}
              />
            ))
          )}
          {branchError ? <ErrorText text={branchError} /> : null}
          <AddRow
            value={newBranchId}
            placeholder={t('employee_detail_add_branch')}
            onChange={setNewBranchId}
            onAdd={() => {
              if (newBranchId.trim()) void addBranchMutation.mutateAsync();
            }}
            adding={addBranchMutation.isPending}
          />
        </Section>

        {/* ── Service Assignments ──────────────────────────────────────────── */}
        <Section title={t('employee_detail_service_assignments')}>
          {serviceAssignments.isLoading ? (
            <LoadingRow label={t('employee_detail_assignments_loading')} />
          ) : serviceAssignments.error ? (
            <ErrorText text={t('employee_detail_assignments_load_failed')} />
          ) : serviceAssignments.data && serviceAssignments.data.length === 0 ? (
            <EmptyText text={t('employee_detail_no_services')} />
          ) : (
            (serviceAssignments.data ?? []).map((sa) => (
              <AssignmentRow
                key={sa.productId}
                label={sa.productName || sa.productId}
                sublabel={sa.productId}
                onRemove={() => void removeServiceMutation.mutateAsync(sa.productId)}
                removing={removeServiceMutation.isPending}
              />
            ))
          )}
          {serviceError ? <ErrorText text={serviceError} /> : null}
          <AddRow
            value={newProductId}
            placeholder={t('employee_detail_add_service')}
            onChange={setNewProductId}
            onAdd={() => {
              if (newProductId.trim()) void addServiceMutation.mutateAsync();
            }}
            adding={addServiceMutation.isPending}
          />
        </Section>

        {/* ── Weekly Availability ──────────────────────────────────────────── */}
        <Section title={t('employee_detail_availability')}>
          {!branchId ? (
            <EmptyText text={t('merchant_branch_access_missing')} />
          ) : weeklyAvailability.isLoading ? (
            <LoadingRow label={t('employee_detail_assignments_loading')} />
          ) : (
            <>
              {localSlots.length === 0 ? (
                <EmptyText text={t('employee_detail_no_availability')} />
              ) : (
                localSlots.map((slot, idx) => (
                  <View key={idx} style={styles.slotRow}>
                    <View style={styles.slotDayPicker}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {DAYS_OF_WEEK.map((d) => (
                          <TouchableOpacity
                            key={d}
                            style={[
                              styles.dayChip,
                              slot.dayOfWeek === d && styles.dayChipActive,
                            ]}
                            onPress={() => updateSlot(idx, 'dayOfWeek', d)}
                            activeOpacity={0.8}
                          >
                            <Text
                              style={[
                                styles.dayChipText,
                                slot.dayOfWeek === d && styles.dayChipTextActive,
                              ]}
                            >
                              {DAY_LABELS[d]}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                    <View style={styles.slotTimes}>
                      <TextInput
                        style={styles.timeInput}
                        value={slot.startTime}
                        onChangeText={(v) => updateSlot(idx, 'startTime', v)}
                        placeholder="09:00"
                        placeholderTextColor={colors.gray400}
                        keyboardType="numbers-and-punctuation"
                      />
                      <Text style={styles.timeSep}>–</Text>
                      <TextInput
                        style={styles.timeInput}
                        value={slot.endTime}
                        onChangeText={(v) => updateSlot(idx, 'endTime', v)}
                        placeholder="17:00"
                        placeholderTextColor={colors.gray400}
                        keyboardType="numbers-and-punctuation"
                      />
                      <TouchableOpacity
                        onPress={() => removeAvailabilitySlot(idx)}
                        hitSlop={8}
                        style={styles.slotRemoveBtn}
                      >
                        <Ionicons name="close-circle" size={20} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
              <TouchableOpacity
                style={styles.addSlotBtn}
                onPress={addAvailabilitySlot}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={18} color={colors.primary} />
                <Text style={styles.addSlotBtnText}>{t('employee_detail_availability_add_slot')}</Text>
              </TouchableOpacity>
              {availError ? <ErrorText text={availError} /> : null}
              <TouchableOpacity
                style={[styles.saveBtn, saveAvailabilityMutation.isPending && styles.btnDisabled]}
                onPress={() => void saveAvailabilityMutation.mutateAsync()}
                disabled={saveAvailabilityMutation.isPending}
                activeOpacity={0.85}
              >
                {saveAvailabilityMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.black} />
                ) : null}
                <Text style={styles.saveBtnText}>
                  {saveAvailabilityMutation.isPending
                    ? t('employee_detail_availability_saving')
                    : t('employee_detail_availability_save')}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </Section>

        {/* ── Availability Exceptions ──────────────────────────────────────── */}
        <Section title={t('employee_detail_exceptions')}>
          {!branchId ? (
            <EmptyText text={t('merchant_branch_access_missing')} />
          ) : exceptions.isLoading ? (
            <LoadingRow label={t('employee_detail_assignments_loading')} />
          ) : (
            <>
              {(exceptions.data ?? []).length === 0 ? (
                <EmptyText text={t('employee_detail_no_exceptions')} />
              ) : (
                (exceptions.data ?? []).map((ex) => (
                  <ExceptionRow
                    key={ex.id}
                    exception={ex}
                    onRemove={() => void removeExceptionMutation.mutateAsync(ex.id)}
                    removing={removeExceptionMutation.isPending}
                  />
                ))
              )}

              <View style={styles.addExceptionForm}>
                <TextInput
                  style={styles.exceptionInput}
                  value={exceptionDate}
                  onChangeText={setExceptionDate}
                  placeholder={t('employee_detail_exception_date')}
                  placeholderTextColor={colors.gray400}
                  keyboardType="numbers-and-punctuation"
                />
                <View style={styles.exceptionToggleRow}>
                  <Text style={styles.exceptionToggleLabel}>{t('employee_detail_exception_unavailable')}</Text>
                  <Switch
                    value={exceptionUnavailable}
                    onValueChange={setExceptionUnavailable}
                    trackColor={{ false: colors.gray300, true: `${colors.primary}80` }}
                    thumbColor={exceptionUnavailable ? colors.primary : colors.gray500}
                  />
                </View>
                {!exceptionUnavailable ? (
                  <View style={styles.exceptionTimeRow}>
                    <TextInput
                      style={[styles.exceptionInput, { flex: 1 }]}
                      value={exceptionStart}
                      onChangeText={setExceptionStart}
                      placeholder={t('employee_detail_exception_start')}
                      placeholderTextColor={colors.gray400}
                      keyboardType="numbers-and-punctuation"
                    />
                    <Text style={styles.timeSep}>–</Text>
                    <TextInput
                      style={[styles.exceptionInput, { flex: 1 }]}
                      value={exceptionEnd}
                      onChangeText={setExceptionEnd}
                      placeholder={t('employee_detail_exception_end')}
                      placeholderTextColor={colors.gray400}
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                ) : null}
                {exceptionError ? <ErrorText text={exceptionError} /> : null}
                <TouchableOpacity
                  style={[styles.saveBtn, (!exceptionDate.trim() || addExceptionMutation.isPending) && styles.btnDisabled]}
                  onPress={() => {
                    if (exceptionDate.trim()) void addExceptionMutation.mutateAsync();
                  }}
                  disabled={!exceptionDate.trim() || addExceptionMutation.isPending}
                  activeOpacity={0.85}
                >
                  {addExceptionMutation.isPending ? (
                    <ActivityIndicator size="small" color={colors.black} />
                  ) : null}
                  <Text style={styles.saveBtnText}>{t('employee_detail_exception_add')}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </Section>
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sectionStyles.container}>
      <Text style={sectionStyles.title}>{title}</Text>
      <View style={[sectionStyles.card, shadow.sm]}>{children}</View>
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  container: {},
  title: { fontSize: 15, fontWeight: '700', color: colors.onSurface, marginBottom: spacing.sm },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.sm,
  },
});

function LoadingRow({ label }: { label: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      <ActivityIndicator size="small" color={colors.primary} />
      <Text style={{ fontSize: 13, color: colors.gray600 }}>{label}</Text>
    </View>
  );
}

function EmptyText({ text }: { text: string }) {
  return <Text style={{ fontSize: 13, color: colors.gray500, fontStyle: 'italic' }}>{text}</Text>;
}

function ErrorText({ text }: { text: string }) {
  return <Text style={{ fontSize: 13, color: colors.error }}>{text}</Text>;
}

function AssignmentRow({
  label,
  sublabel,
  onRemove,
  removing,
}: {
  label: string;
  sublabel?: string;
  onRemove: () => void;
  removing: boolean;
}) {
  const { t } = useLanguage();
  return (
    <View style={styles.assignmentRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.assignmentLabel}>{label}</Text>
        {sublabel ? <Text style={styles.assignmentSublabel}>{sublabel}</Text> : null}
      </View>
      <TouchableOpacity
        onPress={onRemove}
        disabled={removing}
        style={styles.removeBtn}
        activeOpacity={0.7}
      >
        <Text style={styles.removeBtnText}>{t('employee_detail_remove')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function AddRow({
  value,
  placeholder,
  onChange,
  onAdd,
  adding,
}: {
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  adding: boolean;
}) {
  return (
    <View style={styles.addRow}>
      <TextInput
        style={styles.addRowInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.gray400}
        autoCapitalize="none"
        returnKeyType="done"
        onSubmitEditing={onAdd}
      />
      <TouchableOpacity
        style={[styles.addRowBtn, (!value.trim() || adding) && styles.btnDisabled]}
        onPress={onAdd}
        disabled={!value.trim() || adding}
        activeOpacity={0.8}
      >
        {adding ? (
          <ActivityIndicator size="small" color={colors.black} />
        ) : (
          <Ionicons name="add" size={18} color={colors.black} />
        )}
      </TouchableOpacity>
    </View>
  );
}

function ExceptionRow({
  exception,
  onRemove,
  removing,
}: {
  exception: AvailabilityException;
  onRemove: () => void;
  removing: boolean;
}) {
  const { t } = useLanguage();
  const label = exception.unavailable
    ? `${exception.date} — full day`
    : `${exception.date} ${exception.startTime ?? ''} – ${exception.endTime ?? ''}`;
  return (
    <View style={styles.assignmentRow}>
      <Text style={[styles.assignmentLabel, { flex: 1 }]}>{label}</Text>
      <TouchableOpacity
        onPress={onRemove}
        disabled={removing}
        style={styles.removeBtn}
        activeOpacity={0.7}
      >
        <Text style={styles.removeBtnText}>{t('employee_detail_remove')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
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
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface, flex: 1, textAlign: 'center' },
  assignmentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  assignmentLabel: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  assignmentSublabel: { fontSize: 12, color: colors.gray500, marginTop: 1 },
  removeBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: `${colors.error}10`,
  },
  removeBtnText: { fontSize: 12, fontWeight: '600', color: colors.error },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  addRowInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.onSurface,
  },
  addRowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.45 },
  slotRow: { gap: spacing.xs },
  slotDayPicker: {},
  dayChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    marginRight: 6,
  },
  dayChipActive: { backgroundColor: colors.primary },
  dayChipText: { fontSize: 12, fontWeight: '600', color: colors.gray700 },
  dayChipTextActive: { color: colors.black },
  slotTimes: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  timeInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gray200,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    fontSize: 14,
    color: colors.onSurface,
    textAlign: 'center',
  },
  timeSep: { fontSize: 16, color: colors.gray600, fontWeight: '600' },
  slotRemoveBtn: { padding: 4 },
  addSlotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  addSlotBtnText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: colors.black },
  addExceptionForm: { gap: spacing.sm, marginTop: spacing.xs },
  exceptionInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.onSurface,
  },
  exceptionToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exceptionToggleLabel: { fontSize: 14, color: colors.onSurface },
  exceptionTimeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
