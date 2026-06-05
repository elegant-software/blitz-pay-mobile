import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useLanguage } from '../lib/LanguageContext';
import { colors, spacing, radius, shadow } from '../lib/theme';
import type { RootStackNav, RootStackParamList } from '../types';
import { fetchBookableSlots } from '../features/appointments/services/appointmentService';
import type { BookableSlot } from '../features/appointments/types/appointment';

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // Monday-based
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatWeekLabel(monday: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(monday);
}

function formatDayHeader(date: Date): { day: string; num: string } {
  const day = new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(date);
  const num = new Intl.DateTimeFormat('en-GB', { day: 'numeric' }).format(date);
  return { day, num };
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(
    new Date(iso),
  );
}

function isSameDay(date: Date, iso: string): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === date.getFullYear() &&
    d.getMonth() === date.getMonth() &&
    d.getDate() === date.getDate()
  );
}

export default function AvailableSlotsScreen() {
  const { t } = useLanguage();
  const navigation = useNavigation<RootStackNav>();
  const route = useRoute<RouteProp<RootStackParamList, 'AvailableSlots'>>();
  const insets = useSafeAreaInsets();

  const { branchId, productId, productCategoryId, productName, merchantName, branchName } = route.params;

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [slots, setSlots] = useState<BookableSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const loadSlots = useCallback(async (from: Date) => {
    setLoading(true);
    setError(null);
    try {
      const to = addDays(from, 7);
      const result = await fetchBookableSlots({
        branchId,
        productCategoryId,
        from: from.toISOString(),
        to: to.toISOString(),
      });
      setSlots(result);
    } catch {
      setError('available_slots_load_failed');
    } finally {
      setLoading(false);
    }
  }, [branchId, productCategoryId]);

  useEffect(() => {
    void loadSlots(weekStart);
  }, [weekStart, loadSlots]);

  const slotsForDay = (day: Date): BookableSlot[] =>
    slots.filter((slot) => isSameDay(day, slot.startTime));

  const handleSelectSlot = (slot: BookableSlot) => {
    navigation.navigate('BookingConfirmation', {
      branchId,
      productId,
      productCategoryId,
      productName,
      merchantName,
      branchName,
      startTime: slot.startTime,
      endTime: slot.endTime,
      employeeId: slot.employeeId,
      employeeName: slot.employeeName,
    });
  };

  const activeDay = selectedDay ?? weekDays.find((d) => slotsForDay(d).length > 0) ?? weekDays[0];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{t('available_slots')}</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Service info */}
      <View style={styles.serviceBanner}>
        <View style={styles.serviceIconWrap}>
          <Ionicons name="calendar-outline" size={22} color={colors.secondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.serviceName}>{productName}</Text>
          <Text style={styles.serviceBranch}>{branchName} · {merchantName}</Text>
        </View>
      </View>

      {/* Week navigation */}
      <View style={styles.weekNav}>
        <TouchableOpacity
          style={styles.weekNavBtn}
          onPress={() => {
            const prev = addDays(weekStart, -7);
            if (prev >= startOfWeek(new Date())) {
              setWeekStart(prev);
              setSelectedDay(null);
            }
          }}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.weekLabel}>
          {t('week_of').replace('{date}', formatWeekLabel(weekStart))}
        </Text>
        <TouchableOpacity
          style={styles.weekNavBtn}
          onPress={() => {
            setWeekStart(addDays(weekStart, 7));
            setSelectedDay(null);
          }}
          hitSlop={8}
        >
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Day picker */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dayPickerContent}
        style={styles.dayPicker}
      >
        {weekDays.map((day) => {
          const { day: dayLabel, num } = formatDayHeader(day);
          const hasSlotsOnDay = slotsForDay(day).length > 0;
          const isActive = activeDay.toDateString() === day.toDateString();
          return (
            <TouchableOpacity
              key={day.toISOString()}
              style={[
                styles.dayChip,
                isActive && styles.dayChipActive,
                !hasSlotsOnDay && styles.dayChipDisabled,
              ]}
              onPress={() => setSelectedDay(day)}
              disabled={!hasSlotsOnDay}
            >
              <Text style={[styles.dayChipLabel, isActive && styles.dayChipLabelActive, !hasSlotsOnDay && styles.dayChipLabelDisabled]}>
                {dayLabel}
              </Text>
              <Text style={[styles.dayChipNum, isActive && styles.dayChipNumActive, !hasSlotsOnDay && styles.dayChipNumDisabled]}>
                {num}
              </Text>
              {hasSlotsOnDay && !isActive && <View style={styles.dotIndicator} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Slots list */}
      {loading ? (
        <View style={styles.stateCard}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateTitle}>{t('available_slots_loading')}</Text>
        </View>
      ) : error ? (
        <View style={styles.stateCard}>
          <Ionicons name="alert-circle-outline" size={24} color={colors.secondary} />
          <Text style={styles.stateTitle}>{t('available_slots_load_failed')}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void loadSlots(weekStart)}>
            <Text style={styles.retryBtnText}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 32 + insets.bottom }} showsVerticalScrollIndicator={false}>
          <Text style={styles.dayHeading}>
            {new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(activeDay)}
          </Text>
          {slotsForDay(activeDay).length === 0 ? (
            <View style={styles.stateCard}>
              <Ionicons name="time-outline" size={24} color={colors.gray400} />
              <Text style={styles.stateTitle}>{t('available_slots_empty_title')}</Text>
              <Text style={styles.stateBody}>{t('available_slots_empty_body')}</Text>
            </View>
          ) : (
            <View style={styles.slotsSection}>
              {slotsForDay(activeDay).map((slot) => (
                <TouchableOpacity
                  key={`${slot.startTime}-${slot.employeeId}`}
                  style={styles.slotCard}
                  onPress={() => handleSelectSlot(slot)}
                  activeOpacity={0.8}
                >
                  <View style={styles.slotTimeBlock}>
                    <Text style={styles.slotTime}>{formatTime(slot.startTime)}</Text>
                    <Text style={styles.slotTimeSep}>–</Text>
                    <Text style={styles.slotTime}>{formatTime(slot.endTime)}</Text>
                  </View>
                  <View style={styles.slotInfo}>
                    <Text style={styles.slotEmployee}>
                      {slot.employeeName
                        ? t('slot_employee').replace('{name}', slot.employeeName)
                        : t('slot_any_employee')}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.primary} />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  backBtn: {},
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: colors.onSurface,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },
  serviceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  serviceIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: `${colors.secondary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceName: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  serviceBranch: { fontSize: 12, color: colors.gray600, marginTop: 2 },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  weekNavBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: `${colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray700,
  },
  dayPicker: {
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  dayPickerContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  dayChip: {
    width: 48,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  dayChipActive: {
    backgroundColor: colors.primary,
  },
  dayChipDisabled: {
    opacity: 0.4,
  },
  dayChipLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.gray600,
    textTransform: 'uppercase',
  },
  dayChipLabelActive: { color: colors.black },
  dayChipLabelDisabled: { color: colors.gray400 },
  dayChipNum: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
    marginTop: 2,
  },
  dayChipNumActive: { color: colors.black },
  dayChipNumDisabled: { color: colors.gray400 },
  dotIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 4,
  },
  dayHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  slotsSection: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  slotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray200,
    gap: spacing.sm,
    ...shadow.sm,
  },
  slotTimeBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 100,
  },
  slotTime: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  slotTimeSep: {
    fontSize: 13,
    color: colors.gray600,
  },
  slotInfo: { flex: 1 },
  slotEmployee: {
    fontSize: 14,
    color: colors.onSurface,
    fontWeight: '500',
  },
  stateCard: {
    margin: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    ...shadow.sm,
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onSurface,
    textAlign: 'center',
  },
  stateBody: {
    fontSize: 13,
    color: colors.gray600,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  retryBtnText: {
    color: colors.black,
    fontWeight: '700',
  },
});
