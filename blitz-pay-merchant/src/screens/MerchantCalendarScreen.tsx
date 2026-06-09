import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../lib/auth';
import { useLanguage } from '../lib/LanguageContext';
import { colors, spacing, radius, shadow } from '../lib/theme';
import type { RootStackNav } from '../types';
import { useMerchantAppointments } from '../features/appointments/hooks/useMerchantAppointments';
import type { AppointmentResponse } from '../features/appointments/types/appointment';
import {
  APPOINTMENT_STATUS_COLORS,
  getEmployeeColor,
  formatAppointmentTime,
  formatDateHeading,
  formatWeekRange,
  groupAppointmentsByDay,
  groupAppointmentsByEmployee,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameDay,
} from '../features/appointments/appointmentPresentation';

type ViewMode = 'day' | 'week' | 'staff';

export default function MerchantCalendarScreen() {
  const { t } = useLanguage();
  const { activeBranchScope, branchScopeError, retryBranchScope, user } = useAuth();
  const navigation = useNavigation<RootStackNav>();
  const insets = useSafeAreaInsets();
  const isManager = user?.role === 'MANAGER';

  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const { from, to } = useMemo(() => {
    if (viewMode === 'week') {
      return { from: startOfWeek(selectedDate), to: endOfWeek(selectedDate) };
    }
    return { from: startOfDay(selectedDate), to: endOfDay(selectedDate) };
  }, [viewMode, selectedDate]);

  const merchantId = activeBranchScope?.merchantId ?? null;

  const { appointments, employeeNameMap, loading, error, reload } = useMerchantAppointments(merchantId, from, to);

  const grouped = useMemo(
    () => groupAppointmentsByDay(appointments, from, to),
    [appointments, from, to],
  );

  const staffGrouped = useMemo(
    () => groupAppointmentsByEmployee(appointments, employeeNameMap),
    [appointments, employeeNameMap],
  );

  const dayKeys = useMemo(
    () =>
      Array.from(grouped.keys()).sort(
        (a, b) => new Date(a).getTime() - new Date(b).getTime(),
      ),
    [grouped],
  );
  const visibleDayKeys = dayKeys.length > 0 ? dayKeys : [selectedDate.toDateString()];

  function navigatePrev() {
    setSelectedDate((d) => addDays(d, viewMode === 'week' ? -7 : -1));
  }

  function navigateNext() {
    setSelectedDate((d) => addDays(d, viewMode === 'week' ? 7 : 1));
  }

  function goToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setSelectedDate(today);
  }

  const isToday = isSameDay(selectedDate, new Date());

  const headingLabel =
    viewMode === 'week'
      ? formatWeekRange(from, to)
      : formatDateHeading(selectedDate);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>{t('appointments_merchant_title')}</Text>
          <Text style={styles.subtitle}>
            {activeBranchScope?.branchName ?? ''}
          </Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.headerActions}
        >
          {isManager ? (
            <>
              <TouchableOpacity
                style={styles.myScheduleBtn}
                onPress={() => navigation.navigate('EmployeeSetup')}
                activeOpacity={0.8}
              >
                <Ionicons name="people-outline" size={15} color={colors.primary} />
                <Text style={styles.myScheduleBtnText}>Staff</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.myScheduleBtn}
                onPress={() => navigation.navigate('BranchOpeningHours')}
                activeOpacity={0.8}
              >
                <Ionicons name="time-outline" size={15} color={colors.primary} />
                <Text style={styles.myScheduleBtnText}>{t('branch_hours_btn')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.myScheduleBtn}
                onPress={() => navigation.navigate('AppointmentPolicy')}
                activeOpacity={0.8}
              >
                <Ionicons name="settings-outline" size={15} color={colors.primary} />
                <Text style={styles.myScheduleBtnText}>Policy</Text>
              </TouchableOpacity>
            </>
          ) : null}
          <TouchableOpacity
            style={styles.myScheduleBtn}
            onPress={() => navigation.navigate('EmployeeCalendar')}
            activeOpacity={0.8}
          >
            <Ionicons name="person-outline" size={15} color={colors.primary} />
            <Text style={styles.myScheduleBtnText}>My Schedule</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* View mode toggle */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleGroup}>
            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === 'day' && styles.toggleBtnActive]}
              onPress={() => setViewMode('day')}
              activeOpacity={0.8}
            >
              <Text style={[styles.toggleBtnText, viewMode === 'day' && styles.toggleBtnTextActive]}>
                {t('appointments_day')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === 'week' && styles.toggleBtnActive]}
              onPress={() => setViewMode('week')}
              activeOpacity={0.8}
            >
              <Text style={[styles.toggleBtnText, viewMode === 'week' && styles.toggleBtnTextActive]}>
                {t('appointments_week')}
              </Text>
            </TouchableOpacity>
            {isManager ? (
              <TouchableOpacity
                style={[styles.toggleBtn, viewMode === 'staff' && styles.toggleBtnActive]}
                onPress={() => setViewMode('staff')}
                activeOpacity={0.8}
              >
                <Text style={[styles.toggleBtnText, viewMode === 'staff' && styles.toggleBtnTextActive]}>
                  {t('appointments_staff')}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {!isToday ? (
            <TouchableOpacity style={styles.todayBtn} onPress={goToday} activeOpacity={0.8}>
              <Text style={styles.todayBtnText}>{t('appointments_today')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Navigation */}
        <View style={styles.navRow}>
          <TouchableOpacity style={styles.navBtn} onPress={navigatePrev} hitSlop={8}>
            <Ionicons name="chevron-back" size={20} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.navLabel} numberOfLines={1}>{headingLabel}</Text>
          <TouchableOpacity style={styles.navBtn} onPress={navigateNext} hitSlop={8}>
            <Ionicons name="chevron-forward" size={20} color={colors.onSurface} />
          </TouchableOpacity>
        </View>
      </View>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: 90 + insets.bottom }]}
        onPress={() => navigation.navigate('NewAppointment')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={26} color={colors.black} />
      </TouchableOpacity>

      {/* Body */}
      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerText}>{t('appointments_loading')}</Text>
        </View>
      ) : branchScopeError || error ? (
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={styles.centerTitle}>{t('error')}</Text>
          <Text style={styles.centerText}>
            {t(
              (branchScopeError ?? error ?? 'appointments_load_failed') as Parameters<
                typeof t
              >[0],
            )}
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => void (branchScopeError ? retryBranchScope() : reload())}
          >
            <Text style={styles.retryBtnText}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : viewMode === 'staff' ? (
        /* ── Staff grid view ─────────────────────────────────────────── */
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.md,
            paddingBottom: 100 + insets.bottom,
            paddingTop: spacing.sm,
          }}
          showsVerticalScrollIndicator={false}
        >
          {staffGrouped.size === 0 ? (
            <View style={styles.centerState}>
              <Ionicons name="people-outline" size={48} color={colors.gray300} />
              <Text style={styles.centerTitle}>{t('appointments_staff_empty_title')}</Text>
              <Text style={styles.centerText}>{t('appointments_empty_body')}</Text>
            </View>
          ) : (
            Array.from(staffGrouped.entries()).map(([employeeId, entry]) => {
              const accentColor = getEmployeeColor(employeeId === '__unassigned__' ? null : employeeId);
              return (
                <View key={employeeId} style={styles.staffSection}>
                  {/* Employee header */}
                  <View style={[styles.staffHeader, { borderLeftColor: accentColor }]}>
                    <View style={[styles.staffDot, { backgroundColor: accentColor }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.staffName}>{entry.name}</Text>
                      <Text style={styles.staffMeta}>
                        {entry.appointments.length} appointment{entry.appointments.length !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  </View>
                  {/* Appointment list for this employee */}
                  {entry.appointments.map((appt) => (
                    <AppointmentCard
                      key={appt.id}
                      appointment={appt}
                      colorBy="status"
                      onPress={() =>
                        navigation.navigate('AppointmentDetail', {
                          appointmentId: appt.id,
                          merchantId: appt.merchantId,
                          scope: 'merchant',
                        })
                      }
                    />
                  ))}
                </View>
              );
            })
          )}
        </ScrollView>
      ) : (
        /* ── Day / Week list view ────────────────────────────────────── */
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.md,
            paddingBottom: 100 + insets.bottom,
            paddingTop: spacing.sm,
          }}
          showsVerticalScrollIndicator={false}
        >
          {visibleDayKeys.map((dayKey) => {
              const dayAppts = grouped.get(dayKey) ?? [];
              const date = new Date(dayKey);
              const isCurrentDay = isSameDay(date, new Date());
              return (
                <View key={dayKey} style={styles.daySection}>
                  <View style={styles.daySectionHeader}>
                    <View
                      style={[
                        styles.dayBadge,
                        isCurrentDay && styles.dayBadgeToday,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayBadgeText,
                          isCurrentDay && styles.dayBadgeTextToday,
                        ]}
                      >
                        {date.getDate()}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.dayName}>
                        {date.toLocaleDateString('en-GB', { weekday: 'long' })}
                      </Text>
                      <Text style={styles.dayMeta}>
                        {date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                        {'  ·  '}
                        {dayAppts.length} appointment{dayAppts.length !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  </View>

                  {dayAppts.length === 0 ? (
                    <View style={styles.dayEmpty}>
                      <Text style={styles.dayEmptyText}>{t('appointments_empty_body')}</Text>
                    </View>
                  ) : (
                    dayAppts.map((appt) => (
                      <AppointmentCard
                        key={appt.id}
                        appointment={appt}
                        colorBy="employee"
                        employeeNameMap={employeeNameMap}
                        onPress={() =>
                          navigation.navigate('AppointmentDetail', {
                            appointmentId: appt.id,
                            merchantId: appt.merchantId,
                            scope: 'merchant',
                          })
                        }
                      />
                    ))
                  )}
                </View>
              );
            })}
        </ScrollView>
      )}
    </View>
  );
}

function AppointmentCard({
  appointment,
  colorBy,
  employeeNameMap,
  onPress,
}: {
  appointment: AppointmentResponse;
  colorBy: 'employee' | 'status';
  employeeNameMap?: ReadonlyMap<string, string>;
  onPress: () => void;
}) {
  const resolvedEmployeeName =
    appointment.employeeName ??
    (appointment.employeeId ? employeeNameMap?.get(appointment.employeeId) : undefined) ??
    null;

  const accentColor =
    colorBy === 'employee'
      ? getEmployeeColor(appointment.employeeId)
      : APPOINTMENT_STATUS_COLORS[appointment.status];

  const isMuted =
    appointment.status === 'CANCELLED' || appointment.status === 'COMPLETED';

  return (
    <TouchableOpacity
      style={[styles.card, shadow.sm, isMuted && styles.cardMuted]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.cardTime} numberOfLines={1}>
            {formatAppointmentTime(appointment.startTime, appointment.endTime)}
          </Text>
          <View
            style={[
              styles.cardStatusPill,
              { backgroundColor: `${APPOINTMENT_STATUS_COLORS[appointment.status]}18` },
            ]}
          >
            <Text
              style={[
                styles.cardStatusText,
                { color: APPOINTMENT_STATUS_COLORS[appointment.status] },
              ]}
            >
              {appointment.status}
            </Text>
          </View>
        </View>
        <Text style={styles.cardContact} numberOfLines={1}>
          {appointment.contactName}
        </Text>
        <Text style={styles.cardProduct} numberOfLines={1}>
          {appointment.productName}
        </Text>
        {resolvedEmployeeName ? (
          <View style={styles.cardEmployeeRow}>
            <View
              style={[
                styles.cardEmployeeDot,
                { backgroundColor: getEmployeeColor(appointment.employeeId) },
              ]}
            />
            <Text style={styles.cardEmployee} numberOfLines={1}>
              {resolvedEmployeeName}
            </Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTop: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.onSurface },
  subtitle: { fontSize: 13, color: colors.gray600, marginTop: 2 },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  myScheduleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${colors.primary}12`,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  myScheduleBtnText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  toggleGroup: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    padding: 3,
  },
  toggleBtn: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  toggleBtnActive: { backgroundColor: colors.white, ...shadow.sm },
  toggleBtnText: { fontSize: 13, fontWeight: '600', color: colors.gray600 },
  toggleBtnTextActive: { color: colors.onSurface },
  todayBtn: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  todayBtnText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface,
    textAlign: 'center',
  },
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
  retryBtnText: { color: colors.black, fontWeight: '700' },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    gap: spacing.md,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.onSurface },
  emptyText: { fontSize: 14, color: colors.gray500, textAlign: 'center' },
  daySection: { marginBottom: spacing.lg },
  daySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  dayBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gray200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayBadgeToday: { backgroundColor: colors.primary },
  dayBadgeText: { fontSize: 15, fontWeight: '700', color: colors.gray700 },
  dayBadgeTextToday: { color: colors.black },
  dayName: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  dayMeta: { fontSize: 12, color: colors.gray500, marginTop: 1 },
  dayEmpty: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  dayEmptyText: { fontSize: 13, color: colors.gray400, fontStyle: 'italic' },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  cardMuted: { opacity: 0.65 },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: spacing.md },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 4,
  },
  cardTime: { fontSize: 13, fontWeight: '700', color: colors.onSurface, flex: 1 },
  cardStatusPill: {
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  cardStatusText: { fontSize: 11, fontWeight: '700' },
  cardContact: { fontSize: 15, fontWeight: '700', color: colors.onSurface, marginBottom: 2 },
  cardProduct: { fontSize: 13, color: colors.gray600 },
  cardEmployeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  cardEmployeeDot: { width: 8, height: 8, borderRadius: 4 },
  cardEmployee: { fontSize: 12, color: colors.gray600, flex: 1 },
  staffSection: {
    marginBottom: spacing.lg,
  },
  staffHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderLeftWidth: 3,
    paddingLeft: spacing.sm,
    marginBottom: spacing.sm,
  },
  staffDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  staffName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.onSurface,
  },
  staffMeta: {
    fontSize: 12,
    color: colors.gray500,
    marginTop: 1,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: colors.black,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
