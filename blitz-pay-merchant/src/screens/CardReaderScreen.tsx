import { useTheme } from "../lib/ThemeContext";
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { requestNeededAndroidPermissions, useStripeTerminal } from '../lib/terminalSdk';
import type { Reader } from '@stripe/stripe-terminal-react-native';
import { useLanguage } from '../lib/LanguageContext';
import { useAuth } from '../lib/auth';
import { observability } from '../lib/observability';
import { spacing, radius, shadow, type ThemeColors } from '../lib/theme';
import {
  clearPairedCardReader,
  fetchConnectionToken,
  loadPairedCardReader,
  savePairedCardReader,
  setTerminalScope,
  type PairedCardReader,
} from '../services/stripeTerminal';

const SCAN_TIMEOUT_S = 30;

/** Settings → "Kartenterminal koppeln": pair the Bluetooth Card Reader (WisePad 3) used for girocard. */
export default function CardReaderScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { t } = useLanguage();
  const { activeBranchScope } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [paired, setPaired] = useState<PairedCardReader | null>(null);
  const [found, setFound] = useState<Reader.Type[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [connectingSerial, setConnectingSerial] = useState<string | null>(null);
  const [battery, setBattery] = useState<number | null>(null);
  const [updateProgress, setUpdateProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    initialize, discoverReaders, cancelDiscovering, connectReader, disconnectReader, connectedReader,
  } = useStripeTerminal({
    onUpdateDiscoveredReaders: setFound,
    onDidStartInstallingUpdate: () => setUpdateProgress(0),
    onDidReportReaderSoftwareUpdateProgress: (progress) => setUpdateProgress(Math.round(Number(progress) * 100)),
    onDidFinishInstallingUpdate: () => setUpdateProgress(null),
    onDidUpdateBatteryLevel: ({ batteryLevel }) => setBattery(batteryLevel),
  });

  useEffect(() => {
    void loadPairedCardReader().then(setPaired);
  }, []);

  // Stop scanning when leaving the screen.
  useEffect(() => () => { void cancelDiscovering().catch(() => null); }, [cancelDiscovering]);

  const isPairedConnected = !!paired && connectedReader?.serialNumber === paired.serialNumber;
  const batteryLevel = battery ?? (isPairedConnected ? connectedReader?.batteryLevel ?? null : null);

  const prepare = useCallback(async () => {
    if (!activeBranchScope) throw new Error(t('merchant_branch_access_missing'));
    setTerminalScope(activeBranchScope.branchId, activeBranchScope.merchantId);
    const { error: initError } = await initialize();
    if (initError) throw new Error(initError.message);
  }, [activeBranchScope, initialize, t]);

  const scan = useCallback(async () => {
    observability.info('card_reader_scan_requested');
    setError(null);
    setFound([]);
    setScanning(true);
    try {
      await prepare();
      if (Platform.OS === 'android') {
        const { error: permissionError } = await requestNeededAndroidPermissions();
        if (permissionError) throw new Error('Bluetooth permission is required to use the card reader');
      }
      // Resolves when the scan times out or is canceled.
      const { error: discoverError } = await discoverReaders({
        discoveryMethod: 'bluetoothScan',
        timeout: SCAN_TIMEOUT_S,
        simulated: __DEV__,
      });
      if (discoverError && discoverError.code !== 'CANCELED') throw new Error(discoverError.message);
    } catch (err) {
      observability.error('card_reader_scan_failed', { reason: err instanceof Error ? err.message : String(err) });
      setError(err instanceof Error ? err.message : t('card_reader_pair_failed'));
    } finally {
      observability.info('card_reader_scan_finished');
      setScanning(false);
      setScanned(true);
    }
  }, [prepare, discoverReaders, t]);

  const pair = useCallback(async (reader: Reader.Type) => {
    if (!activeBranchScope) return;
    if (!reader.serialNumber) {
      observability.warn('card_reader_pair_missing_serial');
      setError(t('card_reader_pair_failed'));
      return;
    }
    setError(null);
    setConnectingSerial(reader.serialNumber);
    observability.info('card_reader_pair_requested', { branchId: activeBranchScope.branchId, readerSerial: reader.serialNumber });
    try {
      await cancelDiscovering().catch(() => null);
      // The reader is registered to the Branch's Terminal Location from the connection-token response.
      const { locationId } = await fetchConnectionToken(activeBranchScope.branchId, activeBranchScope.merchantId);
      if (connectedReader) await disconnectReader();
      const { reader: connected, error: connectError } = await connectReader({
        discoveryMethod: 'bluetoothScan',
        reader,
        locationId,
        autoReconnectOnUnexpectedDisconnect: true,
      });
      if (connectError) {
        observability.error('card_reader_pair_failed', { readerSerial: reader.serialNumber, code: connectError.code, reason: connectError.message });
        throw new Error(connectError.message);
      }
      const next = { serialNumber: reader.serialNumber, label: connected?.label ?? reader.label };
      await savePairedCardReader(next);
      setPaired(next);
      setFound([]);
      setBattery(connected?.batteryLevel ?? null);
      observability.info('card_reader_pair_result', { readerSerial: reader.serialNumber, deviceType: reader.deviceType });
    } catch (err) {
      observability.error('card_reader_pair_failed', { reason: err instanceof Error ? err.message : String(err) });
      setError(err instanceof Error ? err.message : t('card_reader_pair_failed'));
    } finally {
      setConnectingSerial(null);
    }
  }, [activeBranchScope, cancelDiscovering, connectedReader, disconnectReader, connectReader, t]);

  const unpair = useCallback(async () => {
    if (!paired) return;
    if (isPairedConnected) await disconnectReader();
    await clearPairedCardReader();
    observability.info('card_reader_unpaired', { readerSerial: paired.serialNumber });
    setPaired(null);
    setBattery(null);
  }, [paired, isPairedConnected, disconnectReader]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('card_reader_pair_title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}>
        <Text style={styles.hint}>{t('card_reader_hint')}</Text>

        {paired ? (
          <View style={[styles.card, shadow.sm]}>
            <View style={styles.row}>
              <Ionicons name="card-outline" size={22} color={colors.secondary} />
              <View style={styles.flex}>
                <Text style={styles.title}>{paired.label || t('card_reader_label')}</Text>
                <Text style={styles.sub}>{paired.serialNumber}</Text>
                <Text style={[styles.sub, { color: isPairedConnected ? colors.success : colors.gray600 }]}>
                  {t(isPairedConnected ? 'card_reader_connected' : 'card_reader_not_connected')}
                  {batteryLevel != null ? ` · ${t('card_reader_battery', { level: Math.round(batteryLevel * 100) })}` : ''}
                </Text>
              </View>
            </View>
            {updateProgress != null ? (
              <Text style={styles.sub}>{t('card_reader_updating', { progress: updateProgress })}</Text>
            ) : null}
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => void unpair()}>
              <Text style={styles.secondaryBtnText}>{t('card_reader_unpair')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.primaryBtn, (scanning || !!connectingSerial) && styles.disabled]}
          disabled={scanning || !!connectingSerial}
          onPress={() => void scan()}
        >
          {scanning ? <ActivityIndicator size="small" color={colors.black} /> : <Ionicons name="bluetooth" size={16} color={colors.black} />}
          <Text style={styles.primaryBtnText}>{t(scanning ? 'card_reader_scanning' : 'card_reader_scan')}</Text>
        </TouchableOpacity>

        {found.map((reader) => (
          <TouchableOpacity
            key={reader.serialNumber}
            style={[styles.card, styles.row, shadow.sm]}
            disabled={!!connectingSerial}
            onPress={() => void pair(reader)}
          >
            <Ionicons name="card-outline" size={22} color={colors.secondary} />
            <View style={styles.flex}>
              <Text style={styles.title}>{reader.label || reader.deviceType}</Text>
              <Text style={styles.sub}>{reader.serialNumber}</Text>
            </View>
            {connectingSerial === reader.serialNumber ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="chevron-forward" size={16} color={colors.gray400} />
            )}
          </TouchableOpacity>
        ))}

        {connectingSerial && updateProgress != null && !paired ? (
          <Text style={styles.sub}>{t('card_reader_updating', { progress: updateProgress })}</Text>
        ) : null}
        {scanned && !scanning && found.length === 0 && !error ? (
          <Text style={styles.sub}>{t('card_reader_none_found')}</Text>
        ) : null}
        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.gray200,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.onSurface },
  hint: { fontSize: 13, color: colors.gray600 },
  card: { backgroundColor: colors.cardBg, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600', color: colors.onSurface },
  sub: { fontSize: 12, color: colors.gray600, marginTop: 2 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: colors.primary, borderRadius: radius.full, padding: spacing.md,
  },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: colors.black },
  secondaryBtn: {
    alignItems: 'center', padding: spacing.sm, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.gray300,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '600', color: colors.onSurface },
  disabled: { opacity: 0.5 },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: `${colors.error}10`, borderRadius: radius.md, padding: spacing.sm,
  },
  errorText: { flex: 1, fontSize: 13, color: colors.error },
});
