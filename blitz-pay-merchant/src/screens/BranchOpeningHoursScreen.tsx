import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/auth';
import { useLanguage } from '../lib/LanguageContext';
import { colors, spacing, radius, shadow } from '../lib/theme';
import type { RootStackNav } from '../types';
import {
  fetchBranchOpeningHours,
  addBranchOpeningWindow,
  removeBranchOpeningWindow,
  fetchBranchOpeningExceptions,
  addBranchOpeningException,
  removeBranchOpeningException,
  type BranchOpeningWindow,
  type BranchOpeningException,
} from '../features/appointments/services/employeeService';

const DAY_LABELS: Record<number, string> = {
  1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun',
};
const DAYS = [1, 2, 3, 4, 5, 6, 7];

export default function BranchOpeningHoursScreen() {
  const { t } = useLanguage();
  const { activeBranchScope } = useAuth();
  const navigation = useNavigation<RootStackNav>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const merchantId = activeBranchScope?.merchantId ?? '';
  const branchId = activeBranchScope?.branchId ?? '';

  // ── Weekly windows ─────────────────────────────────────────────────────────
  const [newSlot, setNewSlot] = useState({ dayOfWeek: 1, startTime: '09:00', endTime: '22:00' });
  const [slotError, setSlotError] = useState<string | null>(null);

  const windowsQuery = useQuery({
    queryKey: ['branch_opening_hours', merchantId, branchId],
    queryFn: () => fetchBranchOpeningHours(merchantId, branchId),
    enabled: !!merchantId && !!branchId,
    staleTime: 60_000,
  });

  const addWindowMutation = useMutation({
    mutationFn: () => addBranchOpeningWindow(merchantId, branchId, newSlot),
    onSuccess: () => {
      setSlotError(null);
      setNewSlot({ dayOfWeek: 1, startTime: '09:00', endTime: '22:00' });
      void queryClient.invalidateQueries({ queryKey: ['branch_opening_hours', merchantId, branchId] });
    },
    onError: (e: Error) => setSlotError(e.message || t('employee_detail_save_failed')),
  });

  const removeWindowMutation = useMutation({
    mutationFn: (id: string) => removeBranchOpeningWindow(merchantId, branchId, id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['branch_opening_hours', merchantId, branchId] }),
  });

  // ── Exceptions ─────────────────────────────────────────────────────────────
  const [exDate, setExDate] = useState('');
  const [exType, setExType] = useState<'CLOSED' | 'EXTRA_WINDOW'>('CLOSED');
  const [exStart, setExStart] = useState('');
  const [exEnd, setExEnd] = useState('');
  const [exError, setExError] = useState<string | null>(null);

  const exceptionsQuery = useQuery({
    queryKey: ['branch_opening_exceptions', merchantId, branchId],
    queryFn: () => fetchBranchOpeningExceptions(merchantId, branchId),
    enabled: !!merchantId && !!branchId,
    staleTime: 60_000,
  });

  const addExceptionMutation = useMutation({
    mutationFn: () => addBranchOpeningException(merchantId, branchId, {
      date: exDate.trim(),
      type: exType,
      startTime: exType === 'EXTRA_WINDOW' && exStart.trim() ? exStart.trim() : null,
      endTime: exType === 'EXTRA_WINDOW' && exEnd.trim() ? exEnd.trim() : null,
    }),
    onSuccess: () => {
      setExDate(''); setExType('CLOSED'); setExStart(''); setExEnd(''); setExError(null);
      void queryClient.invalidateQueries({ queryKey: ['branch_opening_exceptions', merchantId, branchId] });
    },
    onError: (e: Error) => setExError(e.message || t('employee_detail_save_failed')),
  });

  const removeExceptionMutation = useMutation({
    mutationFn: (id: string) => removeBranchOpeningException(merchantId, branchId, id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['branch_opening_exceptions', merchantId, branchId] }),
  });

  if (!merchantId || !branchId) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('branch_opening_hours_title')}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{t('merchant_branch_access_missing')}</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
    >
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('branch_opening_hours_title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Branch info ── */}
        <View style={[styles.infoCard, shadow.sm]}>
          <Ionicons name="storefront-outline" size={18} color={colors.primary} />
          <Text style={styles.infoText}>{activeBranchScope?.branchName ?? t('branch_fallback_name')}</Text>
        </View>

        {/* ── Weekly opening hours ── */}
        <View style={[styles.section, shadow.sm]}>
          <Text style={styles.sectionTitle}>{t('branch_opening_hours_weekly')}</Text>

          {windowsQuery.isLoading ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: spacing.sm }} />
          ) : (windowsQuery.data ?? []).length === 0 ? (
            <Text style={styles.emptyText}>{t('branch_opening_hours_none')}</Text>
          ) : (
            (windowsQuery.data ?? [])
              .slice()
              .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime))
              .map((w) => (
                <WindowRow
                  key={w.id}
                  window={w}
                  onRemove={() => void removeWindowMutation.mutateAsync(w.id)}
                  removing={removeWindowMutation.isPending && removeWindowMutation.variables === w.id}
                />
              ))
          )}

          {/* Day picker */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.md }}>
            {DAYS.map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.dayChip, newSlot.dayOfWeek === d && styles.dayChipActive]}
                onPress={() => setNewSlot((s) => ({ ...s, dayOfWeek: d }))}
                activeOpacity={0.8}
              >
                <Text style={[styles.dayChipText, newSlot.dayOfWeek === d && styles.dayChipTextActive]}>
                  {DAY_LABELS[d]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.timeRow}>
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
              placeholder="22:00"
              placeholderTextColor={colors.gray400}
              keyboardType="numbers-and-punctuation"
            />
          </View>

          {slotError ? <Text style={styles.errorText}>{slotError}</Text> : null}

          <TouchableOpacity
            style={[styles.addBtn, addWindowMutation.isPending && styles.addBtnDisabled]}
            onPress={() => void addWindowMutation.mutateAsync()}
            disabled={addWindowMutation.isPending}
            activeOpacity={0.85}
          >
            {addWindowMutation.isPending
              ? <ActivityIndicator size="small" color={colors.black} />
              : <Ionicons name="add" size={16} color={colors.black} />}
            <Text style={styles.addBtnText}>{t('branch_opening_hours_add_slot')}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Exceptions / Holidays ── */}
        <View style={[styles.section, shadow.sm]}>
          <Text style={styles.sectionTitle}>{t('branch_opening_hours_exceptions')}</Text>
          <Text style={styles.sectionHint}>{t('branch_opening_hours_exceptions_hint')}</Text>

          {exceptionsQuery.isLoading ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: spacing.sm }} />
          ) : (exceptionsQuery.data ?? []).length === 0 ? (
            <Text style={styles.emptyText}>{t('branch_opening_hours_no_exceptions')}</Text>
          ) : (
            (exceptionsQuery.data ?? []).map((ex) => (
              <ExceptionRow
                key={ex.id}
                exception={ex}
                onRemove={() => void removeExceptionMutation.mutateAsync(ex.id)}
              />
            ))
          )}

          {/* Add exception */}
          <TextInput
            style={[styles.timeInput, { flex: 0, width: '100%', marginTop: spacing.md }]}
            value={exDate}
            onChangeText={setExDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.gray400}
            keyboardType="numbers-and-punctuation"
          />

          {/* Type toggle */}
          <View style={styles.typeToggle}>
            {(['CLOSED', 'EXTRA_WINDOW'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.typeBtn, exType === type && styles.typeBtnActive]}
                onPress={() => setExType(type)}
                activeOpacity={0.8}
              >
                <Text style={[styles.typeBtnText, exType === type && styles.typeBtnTextActive]}>
                  {type === 'CLOSED' ? t('branch_opening_hours_closed') : t('branch_opening_hours_extra')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {exType === 'EXTRA_WINDOW' ? (
            <View style={styles.timeRow}>
              <TextInput
                style={styles.timeInput}
                value={exStart}
                onChangeText={setExStart}
                placeholder="09:00"
                placeholderTextColor={colors.gray400}
                keyboardType="numbers-and-punctuation"
              />
              <Text style={styles.timeSep}>–</Text>
              <TextInput
                style={styles.timeInput}
                value={exEnd}
                onChangeText={setExEnd}
                placeholder="22:00"
                placeholderTextColor={colors.gray400}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          ) : null}

          {exError ? <Text style={styles.errorText}>{exError}</Text> : null}

          <TouchableOpacity
            style={[styles.addBtn, addExceptionMutation.isPending && styles.addBtnDisabled]}
            onPress={() => void addExceptionMutation.mutateAsync()}
            disabled={addExceptionMutation.isPending}
            activeOpacity={0.85}
          >
            {addExceptionMutation.isPending
              ? <ActivityIndicator size="small" color={colors.black} />
              : <Ionicons name="add" size={16} color={colors.black} />}
            <Text style={styles.addBtnText}>{t('branch_opening_hours_add_exception')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function WindowRow({ window: w, onRemove, removing }: {
  window: BranchOpeningWindow;
  onRemove: () => void;
  removing: boolean;
}) {
  return (
    <View style={styles.slotRow}>
      <Text style={styles.slotLabel}>
        {DAY_LABELS[w.dayOfWeek]}{'  '}{w.startTime} – {w.endTime}
      </Text>
      <TouchableOpacity onPress={onRemove} hitSlop={8} disabled={removing}>
        {removing
          ? <ActivityIndicator size="small" color={colors.error} />
          : <Ionicons name="close-circle" size={20} color={colors.error} />}
      </TouchableOpacity>
    </View>
  );
}

function ExceptionRow({ exception: ex, onRemove }: {
  exception: BranchOpeningException;
  onRemove: () => void;
}) {
  const label = ex.type === 'CLOSED'
    ? `${ex.date} — Closed`
    : `${ex.date} ${ex.startTime ?? ''} – ${ex.endTime ?? ''}`;
  return (
    <View style={styles.slotRow}>
      <Text style={styles.slotLabel}>{label}</Text>
      <TouchableOpacity onPress={onRemove} hitSlop={8}>
        <Ionicons name="close-circle" size={20} color={colors.error} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingBottom: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.gray200,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface },
  scroll: { padding: spacing.md, gap: spacing.md },
  infoCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.md,
  },
  infoText: { fontSize: 15, fontWeight: '600', color: colors.onSurface },
  section: {
    backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.lg,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.onSurface, marginBottom: spacing.sm },
  sectionHint: { fontSize: 12, color: colors.gray500, marginBottom: spacing.sm },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyText: { fontSize: 13, color: colors.gray500, marginBottom: spacing.sm },
  slotRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.gray100,
  },
  slotLabel: { fontSize: 14, color: colors.onSurface },
  dayChip: {
    paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.gray200, marginRight: spacing.xs,
    backgroundColor: colors.surface,
  },
  dayChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayChipText: { fontSize: 13, fontWeight: '600', color: colors.gray700 },
  dayChipTextActive: { color: colors.black },
  timeRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm,
  },
  timeInput: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.gray200,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    fontSize: 14, color: colors.onSurface,
  },
  timeSep: { fontSize: 16, color: colors.gray500 },
  typeToggle: {
    flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.xs,
  },
  typeBtn: {
    flex: 1, paddingVertical: 8, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.gray200,
    alignItems: 'center', backgroundColor: colors.surface,
  },
  typeBtnActive: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  typeBtnText: { fontSize: 13, fontWeight: '600', color: colors.gray700 },
  typeBtnTextActive: { color: colors.white },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, backgroundColor: colors.primary,
    borderRadius: radius.full, paddingVertical: spacing.sm, marginTop: spacing.md,
  },
  addBtnDisabled: { opacity: 0.55 },
  addBtnText: { fontSize: 14, fontWeight: '700', color: colors.black },
  errorText: { fontSize: 12, color: colors.error, marginTop: spacing.xs },
});
