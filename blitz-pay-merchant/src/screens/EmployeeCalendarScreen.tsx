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
import { useEmployeeAppointments } from '../features/appointments/hooks/useEmployeeAppointments';
import type { AppointmentResponse } from '../features/appointments/types/appointment';
import {
  APPOINTMENT_STATUS_COLORS,
  formatAppointmentTime,
  formatDateHeading,
  formatWeekRange,
  groupAppointmentsByDay,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameDay,
} from '../features/appointments/appointmentPresentation';

type ViewMode = 'day' | 'week';

export default function EmployeeCalendarScreen() {
  const { t } = useLanguage();
  const { activeBranchScope, user, branchScopeError } = useAuth();
  const navigation = useNavigation<RootStackNav>();
  const insets = useSafeAreaInsets();

  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const { from, to } = useMemo(() => {
    if (viewMode === 'day') {
      return { from: startOfDay(selectedDate), to: endOfDay(selectedDate) };
    }
    return { from: startOfWeek(selectedDate), to: endOfWeek(selectedDate) };
  }, [viewMode, selectedDate]);

  const merchantId = activeBranchScope?.merchantId ?? null;
  // The employee ID comes from the logged-in user's profile ID
  const employeeId = user?.id ?? null;

  const { appointments, loading, error, reload } = useEmployeeAppointments(
    merchantId,
    employeeId,
    from,
    to,
  );

  const grouped = useMemo(
    () => groupAppointmentsByDay(appointments, from, to),
    [appointments, from, to],
  );

  const dayKeys = useMemo(
    () =>
      Array.from(grouped.keys()).sort(
        (a, b) => new Date(a).getTime() - new Date(b).getTime(),
      ),
    [grouped],
  );

  function navigatePrev() {
    setSelectedDate((d) => addDays(d, viewMode === 'day' ? -1 : -7));
  }

  function navigateNext() {
    setSelectedDate((d) => addDays(d, viewMode === 'day' ? 1 : 7));
  }

  function goToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setSelectedDate(today);
  }

  const isToday = isSameDay(selectedDate, new Date());

  const headingLabel =
    viewMode === 'day'
      ? formatDateHeading(selectedDate)
      : formatWeekRange(from, to);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>{t('appointments_employee_title')}</Text>
            {user?.name ? (
              <Text style={styles.subtitle}>{user.name}</Text>
            ) : null}
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* View mode toggle */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleGroup}>
            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === 'day' && styles.toggleBtnActive]}
              onPress={() => setViewMode('day')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.toggleBtnText,
                  viewMode === 'day' && styles.toggleBtnTextActive,
                ]}
              >
                {t('appointments_day')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === 'week' && styles.toggleBtnActive]}
              onPress={() => setViewMode('week')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.toggleBtnText,
                  viewMode === 'week' && styles.toggleBtnTextActive,
                ]}
              >
                {t('appointments_week')}
              </Text>
            </TouchableOpacity>
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
          <Text style={styles.navLabel} numberOfLines={1}>
            {headingLabel}
          </Text>
          <TouchableOpacity style={styles.navBtn} onPress={navigateNext} hitSlop={8}>
            <Ionicons name="chevron-forward" size={20} color={colors.onSurface} />
          </TouchableOpacity>
        </View>
      </View>

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
          <TouchableOpacity style={styles.retryBtn} onPress={() => void reload()}>
            <Text style={styles.retryBtnText}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.md,
            paddingBottom: 40 + insets.bottom,
            paddingTop: spacing.sm,
          }}
          showsVerticalScrollIndicator={false}
        >
          {dayKeys.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color={colors.gray300} />
              <Text style={styles.emptyTitle}>{t('appointments_empty_title')}</Text>
              <Text style={styles.emptyText}>{t('appointments_empty_body')}</Text>
            </View>
          ) : (
            dayKeys.map((dayKey) => {
              const dayAppts = grouped.get(dayKey) ?? [];
              const date = new Date(dayKey);
              const isCurrentDay = isSameDay(date, new Date());
              return (
                <View key={dayKey} style={styles.daySection}>
                  <View style={styles.daySectionHeader}>
                    <View style={[styles.dayBadge, isCurrentDay && styles.dayBadgeToday]}>
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
                        {date.toLocaleDateString('en-GB', {
                          month: 'long',
                          year: 'numeric',
                        })}
                        {'  ·  '}
                        {dayAppts.length} appointment{dayAppts.length !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  </View>

                  {dayAppts.length === 0 ? (
                    <View style={styles.dayEmpty}>
                      <Text style={styles.dayEmptyText}>
                        {t('appointments_empty_body')}
                      </Text>
                    </View>
                  ) : (
                    dayAppts.map((appt) => (
                      <EmployeeAppointmentCard
                        key={appt.id}
                        appointment={appt}
                        onPress={() =>
                          navigation.navigate('AppointmentDetail', {
                            appointmentId: appt.id,
                            merchantId: appt.merchantId,
                            scope: 'employee',
                          })
                        }
                      />
                    ))
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

function EmployeeAppointmentCard({
  appointment,
  onPress,
}: {
  appointment: AppointmentResponse;
  onPress: () => void;
}) {
  const statusColor = APPOINTMENT_STATUS_COLORS[appointment.status];
  const isMuted =
    appointment.status === 'CANCELLED' || appointment.status === 'COMPLETED';

  return (
    <TouchableOpacity
      style={[styles.card, shadow.sm, isMuted && styles.cardMuted]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.cardAccent, { backgroundColor: statusColor }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.cardTime} numberOfLines={1}>
            {formatAppointmentTime(appointment.startTime, appointment.endTime)}
          </Text>
          <View
            style={[styles.cardStatusPill, { backgroundColor: `${statusColor}18` }]}
          >
            <Text style={[styles.cardStatusText, { color: statusColor }]}>
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
        {appointment.note ? (
          <Text style={styles.cardNote} numberOfLines={1}>
            {appointment.note}
          </Text>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '700', color: colors.onSurface },
  subtitle: { fontSize: 12, color: colors.gray600, marginTop: 2 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
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
  emptyState: { alignItems: 'center', paddingTop: 80, gap: spacing.md },
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
  dayEmpty: { paddingVertical: spacing.md, paddingHorizontal: spacing.sm },
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
  cardStatusPill: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  cardStatusText: { fontSize: 11, fontWeight: '700' },
  cardContact: { fontSize: 15, fontWeight: '700', color: colors.onSurface, marginBottom: 2 },
  cardProduct: { fontSize: 13, color: colors.gray600 },
  cardNote: { fontSize: 12, color: colors.gray500, marginTop: 4, fontStyle: 'italic' },
});
