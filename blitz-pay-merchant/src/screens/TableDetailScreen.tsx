import React, { useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useLanguage } from '../lib/LanguageContext';
import { colors, radius, spacing } from '../lib/theme';
import type { RootStackNav, RootStackParamList } from '../types';
import { useLiveFloor, useTableActions } from '../features/tables/hooks/useLiveFloor';
import { PIN_COLORS } from '../features/tables/components/FloorPlanCanvas';
import {
  CenterState,
  ErrorBanner,
  TablesScreenFrame,
  tableStyles,
} from '../features/tables/components/TablesChrome';
import {
  hasUnpaidOrders,
  isOrderOpenForPayment,
  MAX_GUESTS,
  MIN_GUESTS,
  paymentStatusLabel,
  tablePinTone,
} from '../features/tables/tableLogic';
import { formatPickupNumber } from '../features/orders/orderPresentation';
import { PreparationStatusBadge } from '../features/orders/components/PreparationStatusBadge';
import type { MerchantPreparationStatus } from '../features/orders/types/order';
import type { TableOrderSummary } from '../features/tables/types/table';

function formatCurrency(amountMinor: number, currency: string) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(amountMinor / 100);
}

function formatTime(iso: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function isPreparationStatus(value: string | null): value is MerchantPreparationStatus {
  return value === 'RECEIVED' || value === 'PREPARING' || value === 'READY';
}

export default function TableDetailScreen() {
  const { t } = useLanguage();
  const navigation = useNavigation<RootStackNav>();
  const { tableId } = useRoute<RouteProp<RootStackParamList, 'TableDetail'>>().params;
  const vm = useLiveFloor({ live: false });
  const actions = useTableActions(tableId);
  const live = vm.floor.tables.find((candidate) => candidate.table.id === tableId) ?? null;
  const [seatDraft, setSeatDraft] = useState(2);

  const frame = (title: string, children: React.ReactNode) => (
    <TablesScreenFrame title={title} onBack={() => navigation.goBack()}>{children}</TablesScreenFrame>
  );

  if (vm.loading) return frame(t('floor_view_title'), <CenterState loading text={t('loading')} />);
  if (!live) return frame(t('floor_view_title'), <CenterState icon="alert-circle-outline" text={t('table_not_found')} />);

  const tone = tablePinTone(live);
  const unpaid = live.orders.filter(isOrderOpenForPayment);

  const confirmClear = () => {
    const unpaidWarning = hasUnpaidOrders(live);
    Alert.alert(
      t('table_clear_title'),
      unpaidWarning ? t('table_clear_unpaid_body', { count: unpaid.length }) : t('table_clear_body'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: unpaidWarning ? t('table_clear_anyway') : t('table_clear_action'),
          style: unpaidWarning ? 'destructive' : 'default',
          onPress: () => void actions.clear(),
        },
      ],
    );
  };

  const confirmCash = (order: TableOrderSummary) => {
    Alert.alert(
      t('table_confirm_cash_title'),
      t('table_confirm_cash_body', { amount: formatCurrency(order.totalAmountMinor, order.currency) }),
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('table_confirm_cash_action'), onPress: () => void actions.confirmCash(order.orderId, t('table_cash_note')) },
      ],
    );
  };

  return frame(
    t('table_label', { name: live.table.name }),
    <ScrollView
      contentContainerStyle={{ paddingBottom: spacing.xxl }}
      refreshControl={<RefreshControl refreshing={vm.refreshing} onRefresh={() => void vm.reload()} />}
    >
      <View style={tableStyles.card}>
        <View style={tableStyles.row}>
          <View style={[styles.statusDot, { backgroundColor: PIN_COLORS[tone] }]} />
          <Text style={styles.statusText}>
            {live.status === 'OCCUPIED' ? t('table_status_occupied') : live.status === 'RESERVED' ? t('table_status_reserved') : t('table_status_free')}
          </Text>
        </View>
        {live.occupiedSince ? (
          <Text style={[tableStyles.hint, styles.spacedSm]}>{t('table_occupied_since', { time: formatTime(live.occupiedSince) })}</Text>
        ) : null}
        <View style={[tableStyles.row, styles.spaced]}>
          <Ionicons name="people-outline" size={18} color={colors.gray700} />
          <Text style={styles.guestsLabel}>
            {t('table_guests_label')} · {t('table_seats_value', { seats: live.table.seats ?? '?' })}
          </Text>
          <GuestStepper
            value={live.guestCount ?? seatDraft}
            disabled={actions.savingGuests}
            onChange={(next) => {
              if (live.guestCount == null) setSeatDraft(next);
              else void actions.setGuests(next);
            }}
          />
        </View>
        {live.guestCount == null ? (
          <TouchableOpacity
            style={[tableStyles.primaryBtn, styles.spaced, actions.savingGuests && tableStyles.disabled]}
            disabled={actions.savingGuests}
            onPress={() => void actions.setGuests(seatDraft)}
          >
            <Ionicons name="person-add-outline" size={16} color={colors.black} />
            <Text style={tableStyles.primaryBtnText}>{t('table_seat_guests', { count: seatDraft })}</Text>
          </TouchableOpacity>
        ) : null}
        {live.status === 'OCCUPIED' ? (
          <TouchableOpacity
            style={[tableStyles.secondaryBtn, styles.spaced, actions.clearing && tableStyles.disabled]}
            disabled={actions.clearing}
            onPress={confirmClear}
          >
            {actions.clearing ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="sparkles-outline" size={16} color={colors.onSurface} />}
            <Text style={tableStyles.secondaryBtnText}>{t('table_clear_action')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ErrorBanner error={actions.actionError} />

      <Text style={styles.listTitle}>{t('table_orders_title', { count: live.orders.length })}</Text>
      {live.orders.length === 0 ? <Text style={styles.empty}>{t('table_orders_empty')}</Text> : null}

      {live.orders.map((order) => {
        const open = isOrderOpenForPayment(order);
        const busy = actions.busyOrderId === order.orderId;
        return (
          <View key={order.orderId} style={tableStyles.card}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => navigation.navigate('OrderDetail', { orderId: order.orderId })}
            >
              <View style={tableStyles.row}>
                <Text style={styles.pickup}>
                  {order.pickupNumber != null ? formatPickupNumber(order.pickupNumber) : t('table_order_label')}
                </Text>
                <Text style={styles.time}>{formatTime(order.createdAt)}</Text>
                <View style={styles.flex} />
                <Text style={styles.amount}>{formatCurrency(order.totalAmountMinor, order.currency)}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.gray400} />
              </View>
              <View style={[tableStyles.row, styles.spacedSm]}>
                <View style={[styles.paymentPill, { backgroundColor: open ? `${colors.warning}20` : `${colors.success}20` }]}>
                  <Text style={[styles.paymentText, { color: open ? colors.warning : colors.success }]}>
                    {t(paymentStatusLabel(order.paymentStatus))}
                  </Text>
                </View>
                {isPreparationStatus(order.preparationStatus) ? <PreparationStatusBadge status={order.preparationStatus} /> : null}
              </View>
            </TouchableOpacity>
            {open ? (
              <View style={[tableStyles.row, styles.spaced]}>
                <TouchableOpacity
                  style={[tableStyles.primaryBtn, styles.flex, busy && tableStyles.disabled]}
                  disabled={!!actions.busyOrderId}
                  onPress={() => void actions.chargeWithTapToPay(order.orderId)}
                >
                  {busy && actions.terminalStatus !== 'idle' ? (
                    <ActivityIndicator size="small" color={colors.black} />
                  ) : (
                    <Ionicons name="phone-portrait-outline" size={16} color={colors.black} />
                  )}
                  <Text style={tableStyles.primaryBtnText}>{t('table_charge_tap_to_pay')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[tableStyles.secondaryBtn, styles.flex, busy && tableStyles.disabled]}
                  disabled={!!actions.busyOrderId}
                  onPress={() => confirmCash(order)}
                >
                  <Ionicons name="cash-outline" size={16} color={colors.onSurface} />
                  <Text style={tableStyles.secondaryBtnText}>{t('table_confirm_cash_action')}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        );
      })}
    </ScrollView>,
  );
}

function GuestStepper({ value, disabled, onChange }: { value: number; disabled: boolean; onChange: (next: number) => void }) {
  const { t } = useLanguage();
  return (
    <View style={tableStyles.row}>
      <TouchableOpacity
        style={styles.stepBtn}
        disabled={disabled || value <= MIN_GUESTS}
        accessibilityLabel={t('table_guests_decrease')}
        onPress={() => onChange(value - 1)}
      >
        <Ionicons name="remove" size={18} color={colors.onSurface} />
      </TouchableOpacity>
      <Text style={styles.stepValue}>{value}</Text>
      <TouchableOpacity
        style={styles.stepBtn}
        disabled={disabled || value >= MAX_GUESTS}
        accessibilityLabel={t('table_guests_increase')}
        onPress={() => onChange(value + 1)}
      >
        <Ionicons name="add" size={18} color={colors.onSurface} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  guestsLabel: { flex: 1, fontSize: 14, color: colors.gray700 },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  stepValue: { minWidth: 28, textAlign: 'center', fontSize: 16, fontWeight: '800', color: colors.onSurface },
  flex: { flex: 1 },
  spaced: { marginTop: spacing.md },
  spacedSm: { marginTop: spacing.sm },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  statusText: { fontSize: 16, fontWeight: '700', color: colors.onSurface },
  listTitle: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.md,
    fontSize: 13,
    fontWeight: '700',
    color: colors.gray600,
    textTransform: 'uppercase',
  },
  empty: { textAlign: 'center', color: colors.gray600, padding: spacing.lg },
  pickup: { fontSize: 18, fontWeight: '800', color: colors.onSurface },
  time: { fontSize: 12, color: colors.gray600 },
  amount: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  paymentPill: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  paymentText: { fontSize: 12, fontWeight: '700' },
});
