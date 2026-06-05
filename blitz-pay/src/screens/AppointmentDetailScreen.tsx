import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp, useFocusEffect } from '@react-navigation/native';
import { useLanguage } from '../lib/LanguageContext';
import { colors, spacing, radius, shadow } from '../lib/theme';
import type { RootStackNav, RootStackParamList } from '../types';
import {
  cancelAppointment,
  fetchMyAppointments,
} from '../features/appointments/services/appointmentService';
import type { AppointmentResponse } from '../features/appointments/types/appointment';

const STATUS_COLORS: Record<string, string> = {
  BOOKED: colors.success,
  CANCELLED: colors.error,
  COMPLETED: colors.gray500,
};

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(
    new Date(iso),
  );
}

type TranslationKeys = Parameters<ReturnType<typeof useLanguage>['t']>[0];

export default function AppointmentDetailScreen() {
  const { t } = useLanguage();
  const navigation = useNavigation<RootStackNav>();
  const route = useRoute<RouteProp<RootStackParamList, 'AppointmentDetail'>>();
  const insets = useSafeAreaInsets();

  const { appointmentId } = route.params;

  const [appointment, setAppointment] = useState<AppointmentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await fetchMyAppointments();
      const found = all.find((a) => a.id === appointmentId) ?? null;
      if (!found) {
        setError('appointment_detail_not_found');
      } else {
        setAppointment(found);
      }
    } catch {
      setError('appointments_load_failed');
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleCancel = async () => {
    setShowCancelModal(false);
    setCancelling(true);
    try {
      await cancelAppointment(appointmentId);
      // Refresh appointment data
      const all = await fetchMyAppointments();
      const updated = all.find((a) => a.id === appointmentId) ?? null;
      setAppointment(updated);
      Alert.alert('', t('appointment_cancelled_notice'));
    } catch {
      Alert.alert('', t('appointment_cancel_failed'));
    } finally {
      setCancelling(false);
    }
  };

  const isBookedAndUpcoming =
    appointment?.status === 'BOOKED' && new Date(appointment.startTime) >= new Date();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('appointment_detail_title')}</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.stateCard}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  if (error || !appointment) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('appointment_detail_title')}</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.stateCard}>
          <Ionicons name="alert-circle-outline" size={24} color={colors.secondary} />
          <Text style={styles.stateTitle}>{t('appointments_load_failed')}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void load()}>
            <Text style={styles.retryBtnText}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{t('appointment_detail_title')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: isBookedAndUpcoming ? 120 + insets.bottom : 32 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* Status banner */}
        <View style={[styles.statusBanner, { backgroundColor: `${STATUS_COLORS[appointment.status]}15` }]}>
          <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[appointment.status] }]} />
          <Text style={[styles.statusText, { color: STATUS_COLORS[appointment.status] }]}>
            {t(`appointment_status_${appointment.status}` as TranslationKeys)}
          </Text>
        </View>

        {/* Service */}
        <View style={styles.detailCard}>
          <View style={styles.detailRow}>
            <View style={styles.detailIconWrap}>
              <Ionicons name="cut-outline" size={20} color={colors.secondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailLabel}>{t('appointment_product_label')}</Text>
              <Text style={styles.detailValue}>{appointment.productName}</Text>
            </View>
          </View>

          <View style={styles.detailDivider} />

          {/* Date & Time */}
          <View style={styles.detailRow}>
            <View style={styles.detailIconWrap}>
              <Ionicons name="calendar-outline" size={20} color={colors.secondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailLabel}>{t('appointment_date_label')}</Text>
              <Text style={styles.detailValue}>{formatDateTime(appointment.startTime)}</Text>
              <Text style={styles.detailSubvalue}>
                {formatTime(appointment.startTime)} – {formatTime(appointment.endTime)}
              </Text>
            </View>
          </View>

          {/* Employee */}
          {appointment.employeeId ? (
            <>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <View style={styles.detailIconWrap}>
                  <Ionicons name="person-outline" size={20} color={colors.secondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailLabel}>{t('appointment_employee_label')}</Text>
                  <Text style={styles.detailValue}>Staff assigned</Text>
                </View>
              </View>
            </>
          ) : null}
        </View>

        {/* Contact */}
        <View style={styles.detailCard}>
          <View style={styles.detailRow}>
            <View style={styles.detailIconWrap}>
              <Ionicons name="person-circle-outline" size={20} color={colors.secondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailLabel}>{t('appointment_contact_label')}</Text>
              <Text style={styles.detailValue}>{appointment.contactName}</Text>
              {appointment.contactEmail ? (
                <Text style={styles.detailSubvalue}>{appointment.contactEmail}</Text>
              ) : null}
              {appointment.contactPhone ? (
                <Text style={styles.detailSubvalue}>{appointment.contactPhone}</Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Note */}
        {appointment.note ? (
          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <View style={styles.detailIconWrap}>
                <Ionicons name="document-text-outline" size={20} color={colors.secondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailLabel}>{t('appointment_note_label')}</Text>
                <Text style={styles.detailValue}>{appointment.note}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Cancelled status indicator */}
        {appointment.status === 'CANCELLED' ? (
          <View style={[styles.detailCard, styles.cancelledCard]}>
            <View style={styles.detailRow}>
              <View style={[styles.detailIconWrap, { backgroundColor: `${colors.error}15` }]}>
                <Ionicons name="close-circle-outline" size={20} color={colors.error} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.detailLabel, { color: colors.error }]}>Status</Text>
                <Text style={styles.detailValue}>This appointment was cancelled.</Text>
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Actions for booked upcoming appointments */}
      {isBookedAndUpcoming ? (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={styles.rescheduleBtn}
            onPress={() => {
              navigation.navigate('AvailableSlots', {
                branchId: appointment.branchId,
                productId: appointment.productId,
                productCategoryId: appointment.productCategoryId ?? '',
                productName: appointment.productName,
                merchantName: '',
                branchName: '',
              });
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="calendar-outline" size={17} color={colors.primary} />
            <Text style={styles.rescheduleBtnText}>{t('reschedule_appointment')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cancelBtn, cancelling && styles.cancelBtnDisabled]}
            onPress={() => setShowCancelModal(true)}
            activeOpacity={0.85}
            disabled={cancelling}
          >
            {cancelling ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Ionicons name="close-circle-outline" size={17} color={colors.white} />
            )}
            <Text style={styles.cancelBtnText}>{t('cancel_appointment')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Cancel confirmation modal */}
      <Modal visible={showCancelModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('cancel_appointment_confirm_title')}</Text>
            <Text style={styles.modalDesc}>{t('cancel_appointment_confirm_body')}</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalDismiss}
                onPress={() => setShowCancelModal(false)}
              >
                <Text style={styles.modalDismissText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={() => void handleCancel()}
              >
                <Text style={styles.modalConfirmText}>{t('cancel_appointment_confirm_action')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, backgroundColor: colors.background },
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
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '700',
  },
  detailCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray200,
    ...shadow.sm,
  },
  cancelledCard: {
    borderColor: `${colors.error}30`,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  detailIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: `${colors.secondary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.gray600,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.onSurface,
  },
  detailSubvalue: {
    fontSize: 13,
    color: colors.gray600,
    marginTop: 2,
  },
  detailDivider: {
    height: 1,
    backgroundColor: colors.gray200,
    marginVertical: spacing.sm,
  },
  bottomBar: {
    padding: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    gap: spacing.sm,
  },
  rescheduleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.full,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}10`,
  },
  rescheduleBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.full,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.error,
  },
  cancelBtnDisabled: {
    opacity: 0.6,
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
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
  retryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  retryBtnText: {
    color: colors.black,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlayDark,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.background,
    borderRadius: radius.xxl,
    padding: spacing.xl,
    width: '100%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.onSurface,
    marginBottom: 8,
  },
  modalDesc: {
    fontSize: 14,
    color: colors.gray600,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  modalActions: { flexDirection: 'row', gap: spacing.sm },
  modalDismiss: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.gray300,
    alignItems: 'center',
  },
  modalDismissText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.onSurface,
  },
  modalConfirm: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.error,
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
  },
});
