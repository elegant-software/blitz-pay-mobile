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
  KeyboardAvoidingView,
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
  fetchProductCategories,
  fetchWeeklyAvailability,
  addWeeklyAvailabilitySlot,
  removeWeeklyAvailabilitySlot,
  fetchAvailabilityExceptions,
  addAvailabilityException,
  removeAvailabilityException,
  type WeeklyAvailabilitySlot,
  type DayOfWeek,
  type AvailabilityException,
} from '../features/appointments/services/employeeService';
import { fetchMerchantBranches } from '../lib/merchantBranches';

type RouteProps = RouteProp<RootStackParamList, 'EmployeeDetail'>;

const DAYS_OF_WEEK: DayOfWeek[] = [
  'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY',
];
const DAY_LABELS: Record<DayOfWeek, string> = {
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
  const [branchError, setBranchError] = useState<string | null>(null);

  const branchAssignments = useQuery({
    queryKey: ['employee_branch_assignments', merchantId, employeeId],
    queryFn: () => fetchEmployeeBranchAssignments(merchantId, employeeId),
    staleTime: 30_000,
  });

  const merchantBranches = useQuery({
    queryKey: ['merchant_branches', merchantId],
    queryFn: () => fetchMerchantBranches(merchantId),
    staleTime: 60_000,
  });

  const branchNameMap: Record<string, string> = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const b of merchantBranches.data ?? []) map[b.branchId] = b.name;
    return map;
  }, [merchantBranches.data]);

  const productCategories = useQuery({
    queryKey: ['product_categories', merchantId],
    queryFn: () => fetchProductCategories(merchantId),
    staleTime: 60_000,
  });

  const categoryNameMap: Record<string, string> = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of productCategories.data ?? []) map[c.id] = c.name;
    return map;
  }, [productCategories.data]);

  const categoryCodeMap: Record<string, string> = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of productCategories.data ?? []) map[c.id] = c.code;
    return map;
  }, [productCategories.data]);

  const addBranchMutation = useMutation({
    mutationFn: (bId: string) => addEmployeeBranchAssignment(merchantId, employeeId, bId),
    onSuccess: () => {
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
  const [serviceError, setServiceError] = useState<string | null>(null);

  const serviceAssignments = useQuery({
    queryKey: ['employee_service_assignments', merchantId, employeeId],
    queryFn: () => fetchEmployeeServiceAssignments(merchantId, employeeId),
    staleTime: 30_000,
  });

  const addServiceMutation = useMutation({
    mutationFn: (pId: string) => addEmployeeServiceAssignment(merchantId, employeeId, pId),
    onSuccess: () => {
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
  const [newSlot, setNewSlot] = useState<Omit<WeeklyAvailabilitySlot, 'id'>>({
    dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '17:00',
  });
  const [availError, setAvailError] = useState<string | null>(null);

  const weeklyAvailability = useQuery({
    queryKey: ['employee_availability', merchantId, employeeId, branchId],
    queryFn: () => fetchWeeklyAvailability(merchantId, employeeId, branchId!),
    enabled: !!branchId,
    staleTime: 60_000,
  });

  const addSlotMutation = useMutation({
    mutationFn: () => addWeeklyAvailabilitySlot(merchantId, employeeId, branchId!, newSlot),
    onSuccess: () => {
      setAvailError(null);
      setNewSlot({ dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '17:00' });
      void queryClient.invalidateQueries({ queryKey: ['employee_availability', merchantId, employeeId, branchId] });
    },
    onError: (e: Error) => setAvailError(e.message || t('employee_detail_save_failed')),
  });

  const removeSlotMutation = useMutation({
    mutationFn: (slotId: string) => removeWeeklyAvailabilitySlot(merchantId, employeeId, branchId!, slotId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['employee_availability', merchantId, employeeId, branchId] }),
  });

  // ─── Exceptions ─────────────────────────────────────────────────────────────
  const [exceptionDate, setExceptionDate] = useState('');
  const [exceptionType, setExceptionType] = useState<'BLOCKED' | 'EXTRA_WINDOW'>('BLOCKED');
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
        type: exceptionType,
        startTime: exceptionType === 'EXTRA_WINDOW' && exceptionStart.trim() ? exceptionStart.trim() : null,
        endTime: exceptionType === 'EXTRA_WINDOW' && exceptionEnd.trim() ? exceptionEnd.trim() : null,
      }),
    onSuccess: () => {
      setExceptionDate('');
      setExceptionType('BLOCKED');
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
    <KeyboardAvoidingView style={[styles.container, { paddingTop: insets.top }]} behavior="padding">
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
                label={branchNameMap[ba.branchId] ?? t('employee_detail_unknown_branch')}
                onRemove={() => void removeBranchMutation.mutateAsync(ba.branchId)}
                removing={removeBranchMutation.isPending}
              />
            ))
          )}
          {branchError ? <ErrorText text={branchError} /> : null}
          <SelectRow
            placeholder={t('employee_detail_add_branch')}
            options={(merchantBranches.data ?? [])
              .filter((b) => !(branchAssignments.data ?? []).some((a) => a.branchId === b.branchId))
              .map((b) => ({ label: b.name, value: b.branchId }))}
            onSelect={(bId) => void addBranchMutation.mutateAsync(bId)}
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
            (serviceAssignments.data ?? []).map((sa) => {
              const displayName = sa.name || categoryNameMap[sa.productCategoryId] || sa.productCategoryId;
              const displayCode = sa.code || categoryCodeMap[sa.productCategoryId];
              return (
                <AssignmentRow
                  key={sa.productCategoryId}
                  label={displayName}
                  sublabel={displayCode || undefined}
                  onRemove={() => void removeServiceMutation.mutateAsync(sa.productCategoryId)}
                  removing={removeServiceMutation.isPending}
                />
              );
            })
          )}
          {serviceError ? <ErrorText text={serviceError} /> : null}
          <SelectRow
            placeholder={t('employee_detail_add_service')}
            options={(productCategories.data ?? [])
              .filter((c) => !(serviceAssignments.data ?? []).some((a) => a.productCategoryId === c.id))
              .map((c) => ({ label: c.code ? `${c.name} (${c.code})` : c.name, value: c.id }))}
            onSelect={(cId) => void addServiceMutation.mutateAsync(cId)}
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
              {(weeklyAvailability.data ?? []).length === 0 ? (
                <EmptyText text={t('employee_detail_no_availability')} />
              ) : (
                (weeklyAvailability.data ?? []).map((slot) => (
                  <View key={slot.id} style={styles.slotRow}>
                    <Text style={styles.slotLabel}>
                      {DAY_LABELS[slot.dayOfWeek]}{'  '}{slot.startTime} – {slot.endTime}
                    </Text>
                    <TouchableOpacity
                      onPress={() => slot.id && void removeSlotMutation.mutateAsync(slot.id)}
                      hitSlop={8}
                      style={styles.slotRemoveBtn}
                    >
                      <Ionicons name="close-circle" size={20} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                ))
              )}

              {/* Add new slot form */}
              <View style={styles.newSlotForm}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {DAYS_OF_WEEK.map((d) => (
                    <TouchableOpacity
                      key={d}
                      style={[styles.dayChip, newSlot.dayOfWeek === d && styles.dayChipActive]}
                      onPress={() => setNewSlot((s) => ({ ...s, dayOfWeek: d as DayOfWeek }))}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.dayChipText, newSlot.dayOfWeek === d && styles.dayChipTextActive]}>
                        {DAY_LABELS[d as DayOfWeek]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={styles.slotTimes}>
                  <TextInput
                    style={styles.timeInput}
                    value={newSlot.startTime}
                    onChangeText={(v) => setNewSlot((s) => ({ ...s, startTime: v }))}
                    placeholder="09:00"
                    placeholderTextColor={colors.gray400}
                    keyboardType="numbers-and-punctuation"
                  />
                  <Text style={styles.timeSep}>–</Text>
                  <TextInput
                    style={styles.timeInput}
                    value={newSlot.endTime}
                    onChangeText={(v) => setNewSlot((s) => ({ ...s, endTime: v }))}
                    placeholder="17:00"
                    placeholderTextColor={colors.gray400}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
              </View>
              {availError ? <ErrorText text={availError} /> : null}
              <TouchableOpacity
                style={[styles.saveBtn, addSlotMutation.isPending && styles.btnDisabled]}
                onPress={() => void addSlotMutation.mutateAsync()}
                disabled={addSlotMutation.isPending}
                activeOpacity={0.85}
              >
                {addSlotMutation.isPending
                  ? <ActivityIndicator size="small" color={colors.black} />
                  : null}
                <Text style={styles.saveBtnText}>{t('employee_detail_availability_add_slot')}</Text>
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
                    value={exceptionType === 'BLOCKED'}
                    onValueChange={(v) => setExceptionType(v ? 'BLOCKED' : 'EXTRA_WINDOW')}
                    trackColor={{ false: colors.gray300, true: `${colors.primary}80` }}
                    thumbColor={exceptionType === 'BLOCKED' ? colors.primary : colors.gray500}
                  />
                </View>
                {exceptionType === 'EXTRA_WINDOW' ? (
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
                  onPress={() => { if (exceptionDate.trim()) void addExceptionMutation.mutateAsync(); }}
                  disabled={!exceptionDate.trim() || addExceptionMutation.isPending}
                  activeOpacity={0.85}
                >
                  {addExceptionMutation.isPending ? <ActivityIndicator size="small" color={colors.black} /> : null}
                  <Text style={styles.saveBtnText}>{t('employee_detail_exception_add')}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </Section>
      </ScrollView>
    </KeyboardAvoidingView>
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

function SelectRow({
  placeholder,
  options,
  onSelect,
  adding,
}: {
  placeholder: string;
  options: { label: string; value: string }[];
  onSelect: (value: string) => void;
  adding: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (options.length === 0) return null;

  return (
    <View style={styles.selectRow}>
      <TouchableOpacity
        style={[styles.selectTrigger, adding && styles.btnDisabled]}
        onPress={() => setOpen((o) => !o)}
        disabled={adding}
        activeOpacity={0.8}
      >
        {adding ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name="add" size={16} color={colors.primary} />
        )}
        <Text style={styles.selectTriggerText}>{placeholder}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.gray500} />
      </TouchableOpacity>
      {open && (
        <View style={styles.selectList}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={styles.selectOption}
              onPress={() => {
                setOpen(false);
                onSelect(opt.value);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.selectOptionText}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
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
  const label = exception.type === 'BLOCKED'
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
  selectRow: { marginTop: spacing.xs },
  selectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
  },
  selectTriggerText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.primary },
  selectList: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
    overflow: 'hidden',
    marginTop: 2,
  },
  selectOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
    backgroundColor: colors.white,
  },
  selectOptionText: { fontSize: 14, color: colors.onSurface },
  btnDisabled: { opacity: 0.45 },
  slotRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  slotLabel: { fontSize: 14, color: colors.onSurface, flex: 1 },
  newSlotForm: { gap: spacing.xs, marginTop: spacing.sm },
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
