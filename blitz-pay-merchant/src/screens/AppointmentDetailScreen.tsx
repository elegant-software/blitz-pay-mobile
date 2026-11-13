import { useTheme } from "../lib/ThemeContext";
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../lib/LanguageContext';
import { spacing, radius, shadow, type ThemeColors } from '../lib/theme';
import type { RootStackParamList, RootStackNav } from '../types';
import {
  cancelAppointment,
  completeAppointment,
} from '../features/appointments/services/appointmentService';
import { patchAppointment } from '../features/appointments/services/employeeService';
import type { AppointmentResponse } from '../features/appointments/types/appointment';
import {
  APPOINTMENT_STATUS_COLORS,
  formatAppointmentTime,
} from '../features/appointments/appointmentPresentation';
import { authedFetch } from '../lib/api';
import { observability } from '../lib/observability';

function isFuture(isoDate: string): boolean {
  return new Date(isoDate) > new Date();
}

function isPast(isoDate: string): boolean {
  return new Date(isoDate) <= new Date();
}

type RouteProps = RouteProp<RootStackParamList, 'AppointmentDetail'>;

async function fetchSingleAppointment(
  merchantId: string,
  appointmentId: string,
): Promise<AppointmentResponse> {
  // We fetch the appointment by loading a wide window and finding by id, since there's no
  // single-appointment GET endpoint. For convenience we query a 2-year window centred on now.
  observability.info('appointment_detail_fetch_started', { merchantId, appointmentId });
  const from = new Date();
  from.setFullYear(from.getFullYear() - 1);
  const to = new Date();
  to.setFullYear(to.getFullYear() + 1);

  const params = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
  });

  const response = await authedFetch(
    `/v1/merchants/${encodeURIComponent(merchantId)}/appointments?${params.toString()}`,
    { method: 'GET', headers: { Accept: 'application/json' } },
  );

  if (!response.ok) {
    observability.error('appointment_detail_fetch_failed', {
      merchantId,
      appointmentId,
      status: response.status,
    });
    throw new Error('appointments_load_failed');
  }

  const all = (await response.json()) as AppointmentResponse[];
  const found = all.find((a) => a.id === appointmentId);
  if (!found) throw new Error('appointments_load_failed');

  observability.info('appointment_detail_fetch_succeeded', { merchantId, appointmentId });
  return found;
}

export default function AppointmentDetailScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { t } = useLanguage();
  const navigation = useNavigation<RootStackNav>();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();
  const { appointmentId, merchantId, scope } = route.params;

  const [mutating, setMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [confirmCancelVisible, setConfirmCancelVisible] = useState(false);

  // Note / contact editing state
  const [editNoteVisible, setEditNoteVisible] = useState(false);
  const [editContactVisible, setEditContactVisible] = useState(false);
  const [editNote, setEditNote] = useState('');
  const [editContactName, setEditContactName] = useState('');
  const [editContactEmail, setEditContactEmail] = useState('');
  const [editContactPhone, setEditContactPhone] = useState('');
  const [patchSaving, setPatchSaving] = useState(false);
  const [patchError, setPatchError] = useState<string | null>(null);

  const { data: appointment, isLoading, error, refetch } = useQuery({
    queryKey: ['appointment-detail', merchantId, appointmentId],
    queryFn: () => fetchSingleAppointment(merchantId, appointmentId),
    staleTime: 15_000,
  });

  async function handleComplete() {
    if (!appointment || mutating) return;
    setMutating(true);
    setMutationError(null);
    try {
      await completeAppointment(merchantId, appointmentId);
      void refetch();
    } catch {
      setMutationError(t('appointment_complete_failed'));
    } finally {
      setMutating(false);
    }
  }

  async function handleCancel() {
    if (!appointment || mutating) return;
    setConfirmCancelVisible(false);
    setMutating(true);
    setMutationError(null);
    try {
      await cancelAppointment(merchantId, appointmentId);
      void refetch();
    } catch {
      setMutationError(t('appointment_cancel_failed'));
    } finally {
      setMutating(false);
    }
  }

  function handleReschedule() {
    if (!appointment) return;
    navigation.navigate('RescheduleAppointment', {
      appointmentId,
      merchantId,
      currentProductId: appointment.productId,
      currentProductCategoryId: appointment.productCategoryId,
      currentStartTime: appointment.startTime,
      currentEmployeeId: appointment.employeeId,
    });
  }

  async function handleSaveNote() {
    if (!appointment || patchSaving) return;
    setPatchSaving(true);
    setPatchError(null);
    try {
      await patchAppointment(merchantId, appointmentId, { note: editNote.trim() || null });
      setEditNoteVisible(false);
      void refetch();
    } catch {
      setPatchError(t('appointment_patch_failed'));
    } finally {
      setPatchSaving(false);
    }
  }

  async function handleSaveContact() {
    if (!appointment || patchSaving) return;
    setPatchSaving(true);
    setPatchError(null);
    try {
      await patchAppointment(merchantId, appointmentId, {
        contactName: editContactName.trim() || appointment.contactName,
        contactEmail: editContactEmail.trim() || null,
        contactPhone: editContactPhone.trim() || null,
      });
      setEditContactVisible(false);
      void refetch();
    } catch {
      setPatchError(t('appointment_patch_failed'));
    } finally {
      setPatchSaving(false);
    }
  }

  const statusColor = appointment
    ? APPOINTMENT_STATUS_COLORS[appointment.status]
    : colors.gray400;

  const isBooked = appointment?.status === 'BOOKED';
  // Domain rules:
  // - Cancel / Reschedule: only future BOOKED
  // - Complete: only past BOOKED
  const canCancelOrReschedule = isBooked && appointment != null && isFuture(appointment.startTime);
  const canComplete = isBooked && appointment != null && isPast(appointment.startTime);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('appointment_detail')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centerText}>{t('appointments_loading')}</Text>
        </View>
      ) : !appointment || error ? (
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={styles.centerTitle}>{t('error')}</Text>
          <Text style={styles.centerText}>{t('appointments_load_failed')}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void refetch()}>
            <Text style={styles.retryBtnText}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 96 + insets.bottom }}
          showsVerticalScrollIndicator={false}
        >
          {/* Summary card */}
          <View style={[styles.summaryCard, shadow.md]}>
            <View style={styles.summaryTop}>
              <View style={styles.summaryLeft}>
                <Text style={styles.contactName}>{appointment.contactName}</Text>
                <Text style={styles.productName}>{appointment.productName}</Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: `${statusColor}18` }]}>
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {t(`appointment_status_${appointment.status}` as Parameters<typeof t>[0])}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <DetailRow
              icon="time-outline"
              label={t('appointment_time')}
              value={formatAppointmentTime(appointment.startTime, appointment.endTime)}
            />
            <DetailRow
              icon="person-outline"
              label={t('appointment_employee')}
              value={appointment.employeeName ?? t('appointment_employee_unassigned')}
            />

            {mutationError ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
                <Text style={styles.errorBannerText}>{mutationError}</Text>
              </View>
            ) : null}
          </View>

          {/* Contact section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('appointment_contact')}</Text>
              {appointment.contactType === 'MERCHANT_CAPTURED' ? (
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => {
                    setEditContactName(appointment.contactName);
                    setEditContactEmail(appointment.contactEmail ?? '');
                    setEditContactPhone(appointment.contactPhone ?? '');
                    setPatchError(null);
                    setEditContactVisible(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="pencil-outline" size={14} color={colors.primary} />
                  <Text style={styles.editBtnText}>{t('appointment_edit_contact_title')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={[styles.sectionCard, shadow.sm]}>
              {appointment.contactPhone ? (
                <DetailRow
                  icon="call-outline"
                  label={t('appointment_contact_phone')}
                  value={appointment.contactPhone}
                />
              ) : null}
              {appointment.contactEmail ? (
                <DetailRow
                  icon="mail-outline"
                  label={t('appointment_contact_email')}
                  value={appointment.contactEmail}
                />
              ) : null}
              {!appointment.contactPhone && !appointment.contactEmail ? (
                <Text style={styles.noContactText}>No contact details provided.</Text>
              ) : null}
              {appointment.contactType === 'SHOPPER_OWNED' ? (
                <View style={styles.shopperOwnedBadge}>
                  <Ionicons name="lock-closed-outline" size={12} color={colors.gray600} />
                  <Text style={styles.shopperOwnedText}>Shopper-owned — read only</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Service section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('appointment_product')}</Text>
            <View style={[styles.sectionCard, shadow.sm]}>
              <DetailRow
                icon="cut-outline"
                label={t('appointment_product')}
                value={appointment.productName}
              />
            </View>
          </View>

          {/* Note section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('appointment_note')}</Text>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => {
                  setEditNote(appointment.note ?? '');
                  setPatchError(null);
                  setEditNoteVisible(true);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="pencil-outline" size={14} color={colors.primary} />
                <Text style={styles.editBtnText}>{t('appointment_edit_note_title')}</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.sectionCard, shadow.sm]}>
              {appointment.note ? (
                <Text style={styles.noteText}>{appointment.note}</Text>
              ) : (
                <Text style={styles.noContactText}>No note added.</Text>
              )}
            </View>
          </View>

          {/* Cancellation reason */}
          {appointment.cancelledReason ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('appointment_cancelled_reason')}</Text>
              <View style={[styles.sectionCard, shadow.sm]}>
                <Text style={styles.noteText}>{appointment.cancelledReason}</Text>
              </View>
            </View>
          ) : null}

          {/* Actions — domain-rule-gated */}
          {(canComplete || canCancelOrReschedule) ? (
            <View style={styles.actions}>
              {mutating ? (
                <View style={styles.mutatingRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.mutatingText}>{t('appointment_mutating')}</Text>
                </View>
              ) : (
                <>
                  {canComplete ? (
                    <TouchableOpacity
                      style={styles.primaryAction}
                      onPress={() => void handleComplete()}
                      disabled={mutating}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="checkmark-circle-outline" size={18} color={colors.black} />
                      <Text style={styles.primaryActionText}>{t('appointment_mark_complete')}</Text>
                    </TouchableOpacity>
                  ) : null}

                  {canCancelOrReschedule && scope === 'merchant' ? (
                    <TouchableOpacity
                      style={styles.secondaryAction}
                      onPress={handleReschedule}
                      disabled={mutating}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                      <Text style={styles.secondaryActionText}>{t('appointment_reschedule')}</Text>
                    </TouchableOpacity>
                  ) : null}

                  {canCancelOrReschedule ? (
                    <TouchableOpacity
                      style={styles.destructiveAction}
                      onPress={() => setConfirmCancelVisible(true)}
                      disabled={mutating}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="close-circle-outline" size={18} color={colors.error} />
                      <Text style={styles.destructiveActionText}>{t('appointment_cancel')}</Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              )}
            </View>
          ) : null}
        </ScrollView>
      )}

      {/* Edit Note Modal */}
      <Modal
        visible={editNoteVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditNoteVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{t('appointment_edit_note_title')}</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              value={editNote}
              onChangeText={setEditNote}
              placeholder="Add a note…"
              placeholderTextColor={colors.gray400}
              multiline
              numberOfLines={4}
              autoFocus
            />
            {patchError ? (
              <Text style={styles.patchError}>{patchError}</Text>
            ) : null}
            <TouchableOpacity
              style={[styles.modalDestructiveBtn, { backgroundColor: colors.primary }, patchSaving && styles.patchDisabled]}
              onPress={() => void handleSaveNote()}
              disabled={patchSaving}
              activeOpacity={0.85}
            >
              {patchSaving ? (
                <ActivityIndicator size="small" color={colors.black} />
              ) : null}
              <Text style={[styles.modalDestructiveBtnText, { color: colors.black }]}>
                {patchSaving ? t('appointment_edit_saving') : t('appointment_edit_save')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalDismissBtn}
              onPress={() => setEditNoteVisible(false)}
            >
              <Text style={styles.modalDismissBtnText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Contact Modal (MERCHANT_CAPTURED only) */}
      <Modal
        visible={editContactVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditContactVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{t('appointment_edit_contact_title')}</Text>
            <TextInput
              style={styles.modalInput}
              value={editContactName}
              onChangeText={setEditContactName}
              placeholder="Contact name"
              placeholderTextColor={colors.gray400}
              autoCapitalize="words"
              autoFocus
            />
            <TextInput
              style={styles.modalInput}
              value={editContactPhone}
              onChangeText={setEditContactPhone}
              placeholder="+49 123 456789"
              placeholderTextColor={colors.gray400}
              keyboardType="phone-pad"
            />
            <TextInput
              style={styles.modalInput}
              value={editContactEmail}
              onChangeText={setEditContactEmail}
              placeholder="email@example.com"
              placeholderTextColor={colors.gray400}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {patchError ? (
              <Text style={styles.patchError}>{patchError}</Text>
            ) : null}
            <TouchableOpacity
              style={[styles.modalDestructiveBtn, { backgroundColor: colors.primary }, patchSaving && styles.patchDisabled]}
              onPress={() => void handleSaveContact()}
              disabled={patchSaving}
              activeOpacity={0.85}
            >
              {patchSaving ? (
                <ActivityIndicator size="small" color={colors.black} />
              ) : null}
              <Text style={[styles.modalDestructiveBtnText, { color: colors.black }]}>
                {patchSaving ? t('appointment_edit_saving') : t('appointment_edit_save')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalDismissBtn}
              onPress={() => setEditContactVisible(false)}
            >
              <Text style={styles.modalDismissBtnText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Cancel confirmation modal */}
      <Modal
        visible={confirmCancelVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setConfirmCancelVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{t('appointment_cancel_confirm_title')}</Text>
            <Text style={styles.modalBody}>{t('appointment_cancel_confirm_body')}</Text>
            <TouchableOpacity
              style={styles.modalDestructiveBtn}
              onPress={() => void handleCancel()}
              activeOpacity={0.85}
            >
              <Text style={styles.modalDestructiveBtnText}>{t('appointment_cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalDismissBtn}
              onPress={() => setConfirmCancelVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.modalDismissBtnText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
}) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIconWrap}>
        <Ionicons name={icon} size={16} color={colors.gray600} />
      </View>
      <View style={styles.detailContent}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface },
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
  summaryCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.xl,
    margin: spacing.md,
    padding: spacing.lg,
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  summaryLeft: { flex: 1, minWidth: 0 },
  contactName: { fontSize: 20, fontWeight: '700', color: colors.onSurface },
  productName: { fontSize: 14, color: colors.gray600, marginTop: 2 },
  statusPill: {
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: { color: colors.onSurface, fontSize: 12, fontWeight: '700' },
  divider: { height: 1, backgroundColor: colors.gray200, marginVertical: spacing.md },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  detailIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  detailContent: { flex: 1 },
  detailLabel: { fontSize: 12, color: colors.gray600, marginBottom: 1 },
  detailValue: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  errorBanner: {
    marginTop: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.lg,
    padding: spacing.sm,
    backgroundColor: `${colors.error}10`,
  },
  errorBannerText: { flex: 1, fontSize: 13, color: colors.onSurface },
  section: { paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.onSurface,
    marginBottom: spacing.sm,
  },
  sectionCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.xl,
    padding: spacing.md,
  },
  noContactText: { fontSize: 13, color: colors.gray500 },
  shopperOwnedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  shopperOwnedText: { fontSize: 11, color: colors.gray600, fontStyle: 'italic' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: `${colors.primary}12`,
  },
  editBtnText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  patchError: { fontSize: 13, color: colors.error },
  patchDisabled: { opacity: 0.55 },
  modalInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.onSurface,
  },
  modalTextArea: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: spacing.sm,
  },
  noteText: { fontSize: 14, color: colors.onSurface, lineHeight: 20 },
  actions: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  mutatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  mutatingText: { fontSize: 14, color: colors.gray600 },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
  },
  primaryActionText: { fontSize: 15, fontWeight: '700', color: colors.black },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}10`,
  },
  secondaryActionText: { fontSize: 15, fontWeight: '600', color: colors.primary },
  destructiveAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray300,
    backgroundColor: colors.cardBg,
  },
  destructiveActionText: { fontSize: 15, fontWeight: '600', color: colors.error },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalSheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.lg,
    paddingBottom: 40,
    gap: spacing.sm,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.onSurface, marginBottom: 4 },
  modalBody: { fontSize: 14, color: colors.gray600, marginBottom: spacing.sm, lineHeight: 20 },
  modalDestructiveBtn: {
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.error,
  },
  modalDestructiveBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },
  modalDismissBtn: {
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  modalDismissBtnText: { fontSize: 15, color: colors.gray600 },
});
