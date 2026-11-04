import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, Share, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { useLanguage } from '../lib/LanguageContext';
import { observability } from '../lib/observability';
import { colors, shadow, spacing } from '../lib/theme';
import type { RootStackNav, RootStackParamList } from '../types';
import { useTableSetup } from '../features/tables/hooks/useTableSetup';
import { useNfcTagWriter } from '../features/tables/hooks/useNfcTagWriter';
import { parseSeatsInput } from '../features/tables/tableLogic';
import {
  CapacityWarning,
  CenterState,
  ErrorBanner,
  TablesScreenFrame,
  tableStyles,
} from '../features/tables/components/TablesChrome';
import type { BranchTable } from '../features/tables/types/table';

export default function TableSettingsScreen() {
  const { t } = useLanguage();
  const navigation = useNavigation<RootStackNav>();
  const { tableId } = useRoute<RouteProp<RootStackParamList, 'TableSettings'>>().params;
  const vm = useTableSetup();
  const table = vm.tables.find((candidate) => candidate.id === tableId) ?? null;

  const frame = (title: string, children: React.ReactNode) => (
    <TablesScreenFrame title={title} onBack={() => navigation.goBack()}>{children}</TablesScreenFrame>
  );

  if (!vm.canManage) return frame(t('tables_title'), <CenterState icon="lock-closed-outline" text={t('tables_manager_only')} />);
  if (vm.loading) return frame(t('tables_title'), <CenterState loading text={t('loading')} />);
  if (!table) return frame(t('tables_title'), <CenterState icon="alert-circle-outline" text={t('table_not_found')} />);

  return frame(
    t('table_label', { name: table.name }),
    <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">
      <ErrorBanner error={vm.actionError} />
      <CapacityWarning seated={vm.seatedCapacity} capacity={vm.branchCapacity} />
      <TableLinkCard table={table} />
      <NfcCard table={table} />
      <TableEditCard
        table={table}
        busy={vm.busy}
        onRename={(name) => vm.rename(table.id, name)}
        onSetSeats={(seats) => vm.setSeats(table.id, seats)}
        onSetActive={(active) => vm.setActive(table.id, active)}
        onDelete={() => {
          Alert.alert(t('table_delete_title'), t('table_delete_body', { name: table.name }), [
            { text: t('cancel'), style: 'cancel' },
            {
              text: t('table_delete_action'),
              style: 'destructive',
              onPress: async () => {
                if (await vm.remove(table.id)) navigation.goBack();
              },
            },
          ]);
        }}
      />
    </ScrollView>,
  );
}

function TableLinkCard({ table }: { table: BranchTable }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  return (
    <View style={[tableStyles.card, shadow.sm, styles.qrCard]}>
      {table.link ? (
        <QRCode value={table.link} size={200} color={colors.onSurface} backgroundColor={colors.white} />
      ) : null}
      <Text style={styles.qrTitle}>{t('table_label', { name: table.name })}</Text>
      <Text style={styles.code}>{t('table_code_label', { code: table.code })}</Text>
      <Text style={styles.link} selectable>{table.link}</Text>
      <View style={[tableStyles.row, styles.qrActions]}>
        <TouchableOpacity
          style={[tableStyles.secondaryBtn, styles.flex]}
          onPress={async () => {
            await Clipboard.setStringAsync(table.link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={colors.onSurface} />
          <Text style={tableStyles.secondaryBtnText}>{copied ? t('copied') : t('copy_link')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[tableStyles.primaryBtn, styles.flex]}
          onPress={() => {
            Share.share({ message: table.link, title: t('table_label', { name: table.name }) }).catch((err: unknown) => {
              observability.warn('table_link_share_failed', { reason: err instanceof Error ? err.message : String(err) });
            });
          }}
        >
          <Ionicons name="share-outline" size={16} color={colors.black} />
          <Text style={tableStyles.primaryBtnText}>{t('table_share_link')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function NfcCard({ table }: { table: BranchTable }) {
  const { t } = useLanguage();
  const nfc = useNfcTagWriter();

  if (nfc.availability === null || nfc.availability === 'unsupported') return null;

  if (nfc.availability === 'disabled') {
    return (
      <View style={tableStyles.card}>
        <Text style={tableStyles.sectionTitle}>{t('nfc_write_title')}</Text>
        <Text style={tableStyles.hint}>{t('nfc_disabled_body')}</Text>
        {Platform.OS === 'android' ? (
          <TouchableOpacity style={[tableStyles.secondaryBtn, styles.spaced]} onPress={() => void nfc.openSettings()}>
            <Ionicons name="settings-outline" size={16} color={colors.onSurface} />
            <Text style={tableStyles.secondaryBtnText}>{t('nfc_open_settings')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  const confirmAndWrite = () => {
    Alert.alert(t('nfc_lock_warning_title'), t('nfc_lock_warning_body', { name: table.name }), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('nfc_lock_warning_confirm'), style: 'destructive', onPress: () => void nfc.write(table.link, t('nfc_hold_near_tag')) },
    ]);
  };

  return (
    <View style={tableStyles.card}>
      <Text style={tableStyles.sectionTitle}>{t('nfc_write_title')}</Text>
      <Text style={tableStyles.hint}>{t('nfc_write_hint')}</Text>
      {nfc.state.phase === 'writing' ? (
        <View style={[tableStyles.row, styles.spaced]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={tableStyles.hint}>{t('nfc_hold_near_tag')}</Text>
        </View>
      ) : null}
      {nfc.state.phase === 'succeeded' ? (
        <View style={[tableStyles.row, styles.spaced]}>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={styles.success}>{t('nfc_write_succeeded')}</Text>
        </View>
      ) : null}
      {nfc.state.phase === 'failed' ? (
        <View style={[tableStyles.row, styles.spaced]}>
          <Ionicons name="alert-circle" size={18} color={colors.error} />
          <Text style={styles.failure}>{t(nfc.state.errorKey)}</Text>
        </View>
      ) : null}
      <TouchableOpacity
        style={[tableStyles.primaryBtn, styles.spaced, (nfc.state.phase === 'writing' || !table.link) && tableStyles.disabled]}
        disabled={nfc.state.phase === 'writing' || !table.link}
        onPress={confirmAndWrite}
      >
        <Ionicons name="radio-outline" size={18} color={colors.black} />
        <Text style={tableStyles.primaryBtnText}>{t('nfc_write_action')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function TableEditCard({
  table,
  busy,
  onRename,
  onSetSeats,
  onSetActive,
  onDelete,
}: {
  table: BranchTable;
  busy: boolean;
  onRename: (name: string) => Promise<boolean>;
  onSetSeats: (seats: number | null) => Promise<boolean>;
  onSetActive: (active: boolean) => Promise<boolean>;
  onDelete: () => void;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState(table.name);
  useEffect(() => setName(table.name), [table.name]);
  const dirty = name.trim() !== '' && name.trim() !== table.name;
  const [seatsText, setSeatsText] = useState(table.seats != null ? String(table.seats) : '');
  useEffect(() => setSeatsText(table.seats != null ? String(table.seats) : ''), [table.seats]);
  const seats = parseSeatsInput(seatsText);
  const seatsDirty = seats.valid && seats.seats !== table.seats;

  return (
    <View style={tableStyles.card}>
      <Text style={tableStyles.sectionTitle}>{t('table_name_label')}</Text>
      <View style={tableStyles.row}>
        <TextInput style={[tableStyles.input, styles.flex]} value={name} onChangeText={setName} maxLength={40} />
        <TouchableOpacity
          style={[tableStyles.primaryBtn, (!dirty || busy) && tableStyles.disabled]}
          disabled={!dirty || busy}
          onPress={() => void onRename(name)}
        >
          <Text style={tableStyles.primaryBtnText}>{t('save')}</Text>
        </TouchableOpacity>
      </View>
      <Text style={[tableStyles.sectionTitle, styles.spaced]}>{t('table_seats_label')}</Text>
      <View style={tableStyles.row}>
        <TextInput
          style={[tableStyles.input, styles.flex, !seats.valid && styles.invalid]}
          value={seatsText}
          onChangeText={setSeatsText}
          placeholder={t('table_seats_placeholder')}
          placeholderTextColor={colors.gray500}
          keyboardType="number-pad"
          maxLength={2}
        />
        <TouchableOpacity
          style={[tableStyles.primaryBtn, (!seatsDirty || busy) && tableStyles.disabled]}
          disabled={!seatsDirty || busy}
          onPress={() => void onSetSeats(seats.seats)}
        >
          <Text style={tableStyles.primaryBtnText}>{t('save')}</Text>
        </TouchableOpacity>
      </View>
      {!seats.valid ? <Text style={styles.invalidText}>{t('table_seats_invalid')}</Text> : null}
      <View style={[tableStyles.row, styles.toggleRow]}>
        <View style={styles.flex}>
          <Text style={styles.toggleTitle}>{t('table_active')}</Text>
          <Text style={tableStyles.hint}>{t('table_active_hint')}</Text>
        </View>
        <Switch value={table.active} disabled={busy} onValueChange={(value) => void onSetActive(value)} />
      </View>
      <TouchableOpacity style={[tableStyles.secondaryBtn, styles.spaced]} disabled={busy} onPress={onDelete}>
        <Ionicons name="trash-outline" size={16} color={colors.error} />
        <Text style={tableStyles.dangerBtnText}>{t('table_delete_action')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  qrCard: { alignItems: 'center', paddingVertical: spacing.lg },
  qrTitle: { marginTop: spacing.md, fontSize: 18, fontWeight: '800', color: colors.onSurface },
  code: { marginTop: 4, fontSize: 13, fontWeight: '600', color: colors.gray700, letterSpacing: 1 },
  link: { marginTop: 4, fontSize: 12, color: colors.gray600, textAlign: 'center' },
  qrActions: { marginTop: spacing.md, alignSelf: 'stretch' },
  flex: { flex: 1 },
  spaced: { marginTop: spacing.md },
  success: { flex: 1, fontSize: 14, color: colors.onSurface },
  failure: { flex: 1, fontSize: 14, color: colors.onSurface },
  toggleRow: { marginTop: spacing.md },
  invalid: { borderColor: colors.error },
  invalidText: { marginTop: 4, fontSize: 12, color: colors.error },
  toggleTitle: { fontSize: 15, fontWeight: '600', color: colors.onSurface },
});
