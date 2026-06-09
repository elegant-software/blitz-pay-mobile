import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { useLanguage } from '../lib/LanguageContext';
import { colors, spacing, radius, shadow } from '../lib/theme';
import type { RootStackNav } from '../types';
import { fetchMyAppointments } from '../features/appointments/services/appointmentService';
import type { AppointmentResponse } from '../features/appointments/types/appointment';

const STATUS_COLORS: Record<string, string> = {
  BOOKED: colors.success,
  CANCELLED: colors.error,
  COMPLETED: colors.gray500,
};

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

function isUpcoming(appt: AppointmentResponse): boolean {
  return appt.status === 'BOOKED' && new Date(appt.startTime) >= new Date();
}

type TranslationKeys = Parameters<ReturnType<typeof useLanguage>['t']>[0];

export default function AppointmentsTabScreen() {
  const { t } = useLanguage();
  const navigation = useNavigation<RootStackNav>();
  const insets = useSafeAreaInsets();

  const [appointments, setAppointments] = useState<AppointmentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const result = await fetchMyAppointments();
      setAppointments(result);
    } catch {
      setError('appointments_load_failed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const upcomingList = appointments.filter(isUpcoming);
  const pastList = appointments.filter((a) => !isUpcoming(a));
  const displayList = tab === 'upcoming' ? upcomingList : pastList;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('tab_appointments')}</Text>
      </View>

      {/* Tab switcher */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'upcoming' && styles.tabBtnActive]}
          onPress={() => setTab('upcoming')}
        >
          <Text style={[styles.tabLabel, tab === 'upcoming' && styles.tabLabelActive]}>
            {t('upcoming_appointments')}
            {upcomingList.length > 0 ? ` (${upcomingList.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'past' && styles.tabBtnActive]}
          onPress={() => setTab('past')}
        >
          <Text style={[styles.tabLabel, tab === 'past' && styles.tabLabelActive]}>
            {t('past_appointments')}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.stateCard}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateTitle}>{t('appointments_loading')}</Text>
        </View>
      ) : error ? (
        <View style={styles.stateCard}>
          <Ionicons name="alert-circle-outline" size={24} color={colors.secondary} />
          <Text style={styles.stateTitle}>{t(error as TranslationKeys)}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void load()}>
            <Text style={styles.retryBtnText}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); void load(true); }}
              tintColor={colors.primary}
            />
          }
        >
          {displayList.length === 0 ? (
            <View style={styles.stateCard}>
              <Ionicons name="calendar-outline" size={40} color={colors.gray400} />
              <Text style={styles.stateTitle}>{t('appointments_empty_title')}</Text>
              <Text style={styles.stateBody}>{t('appointments_empty_body')}</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {displayList.map((appt) => (
                <TouchableOpacity
                  key={appt.id}
                  style={[styles.card, shadow.sm]}
                  onPress={() => navigation.navigate('AppointmentDetail', { appointmentId: appt.id })}
                  activeOpacity={0.8}
                >
                  <View style={styles.cardTop}>
                    <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLORS[appt.status]}20` }]}>
                      <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[appt.status] }]} />
                      <Text style={[styles.statusText, { color: STATUS_COLORS[appt.status] }]}>
                        {t(`appointment_status_${appt.status}` as TranslationKeys)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.gray400} />
                  </View>

                  <Text style={styles.cardProduct}>{appt.productName}</Text>
                  <Text style={styles.cardDateTime}>{formatDateTime(appt.startTime)}</Text>

                  {appt.employeeName ? (
                    <View style={styles.cardEmployeeRow}>
                      <Ionicons name="person-outline" size={13} color={colors.gray600} />
                      <Text style={styles.cardEmployeeText}>{appt.employeeName}</Text>
                    </View>
                  ) : null}

                  {isUpcoming(appt) ? (
                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={styles.actionReschedule}
                        onPress={() =>
                          navigation.navigate('AvailableSlots', {
                            branchId: appt.branchId,
                            productId: appt.productId,
                            productCategoryId: appt.productCategoryId ?? '',
                            productName: appt.productName,
                            merchantName: '',
                            branchName: '',
                            rescheduleAppointmentId: appt.id,
                          })
                        }
                        activeOpacity={0.8}
                      >
                        <Ionicons name="calendar-outline" size={14} color={colors.primary} />
                        <Text style={styles.actionRescheduleText}>{t('reschedule_appointment')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionCancel}
                        onPress={() => navigation.navigate('AppointmentDetail', { appointmentId: appt.id })}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="close-outline" size={14} color={colors.error} />
                        <Text style={styles.actionCancelText}>{t('cancel_appointment')}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    backgroundColor: colors.background,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.onSurface },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    backgroundColor: colors.background,
  },
  tabBtn: {
    paddingBottom: spacing.sm,
    paddingHorizontal: 2,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: colors.primary },
  tabLabel: { fontSize: 14, fontWeight: '600', color: colors.gray600 },
  tabLabelActive: { color: colors.primary },
  list: { padding: spacing.md, gap: spacing.sm },
  card: {
    backgroundColor: colors.background,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  cardProduct: { fontSize: 16, fontWeight: '700', color: colors.onSurface, marginBottom: 2 },
  cardDateTime: { fontSize: 13, color: colors.gray700 },
  cardEmployeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  cardEmployeeText: { fontSize: 12, color: colors.gray600 },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  actionReschedule: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}0D`,
  },
  actionRescheduleText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  actionCancel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: `${colors.error}0D`,
  },
  actionCancelText: { fontSize: 13, fontWeight: '600', color: colors.error },
  stateCard: {
    margin: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    ...shadow.sm,
  },
  stateTitle: { fontSize: 16, fontWeight: '700', color: colors.onSurface, textAlign: 'center' },
  stateBody: { fontSize: 13, color: colors.gray600, textAlign: 'center' },
  retryBtn: {
    marginTop: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  retryBtnText: { color: colors.black, fontWeight: '700' },
});
