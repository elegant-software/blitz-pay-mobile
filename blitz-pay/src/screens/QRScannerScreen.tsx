import { parseInvoiceDownloadLink } from '../features/order-payment/invoiceQr';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLanguage } from '../lib/LanguageContext';
import { colors, spacing, radius } from '../lib/theme';
import type { RootStackNav } from '../types';
import { config } from '../lib/config';
import { parseTableLink } from '../features/table-checkin/tableLink';

export default function QRScannerScreen() {
  const { t } = useLanguage();
  const navigation = useNavigation<RootStackNav>();
  const insets = useSafeAreaInsets();

  const [permission, requestPermission] = useCameraPermissions();
  const [flashOn, setFlashOn] = useState(false);
  const [scanned, setScanned] = useState(false);

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    const invoiceUrl = parseInvoiceDownloadLink(data);
    if (invoiceUrl) {
      navigation.replace('InvoicePdf', { url: invoiceUrl, title: t('invoice_view') });
      return;
    }
    const tableCode = parseTableLink(data, config.storefrontUrl, config.trueLayerRedirectScheme);
    if (tableCode) {
      navigation.replace('TableCheckIn', { code: tableCode });
    } else if (data.startsWith('blitzpay://order/')) {
      const orderId = data.replace('blitzpay://order/', '');
      navigation.replace('OrderDetail', { orderId });
    } else if (data.includes('blitzpay://merchant/')) {
      const merchantId = data.split('/').pop();
      navigation.replace('Merchant', { merchantId, merchantName: 'Scanned Merchant' });
    } else {
      navigation.replace('Merchant', { merchantId: '1', merchantName: 'Scanned Merchant' });
    }
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.permissionContainer, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Ionicons name="camera-outline" size={64} color={colors.gray500} />
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionDesc}>
          BlitzPay needs camera access to scan QR codes for payments.
        </Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingsBtn} onPress={() => Linking.openSettings()}>
          <Text style={styles.settingsBtnText}>Open Settings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={flashOn}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      {/* Overlay */}
      <View style={styles.overlay}>
        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.overlayBtn} hitSlop={12}>
            <Ionicons name="close" size={22} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.overlayTitle}>{t('scan_qr')}</Text>
          <TouchableOpacity onPress={() => setFlashOn(!flashOn)} style={styles.overlayBtn} hitSlop={12}>
            <Ionicons name={flashOn ? 'flash' : 'flash-outline'} size={22} color={colors.white} />
          </TouchableOpacity>
        </View>

        {/* Scanning frame */}
        <View style={styles.scannerFrame}>
          <View style={styles.frameContainer}>
            {/* Corners */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />

            {/* Scanning line */}
            <View style={styles.scanLine} />
          </View>
        </View>

        {/* Bottom */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.instructionText}>{t('position_qr_msg')}</Text>

          {scanned && (
            <TouchableOpacity style={styles.rescanBtn} onPress={() => setScanned(false)}>
              <Text style={styles.rescanText}>Tap to Scan Again</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const FRAME_SIZE = 240;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.black },
  permissionContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
    position: 'relative',
  },
  backBtn: {
    position: 'absolute',
    top: 60,
    left: spacing.md,
    zIndex: 10,
  },
  permissionTitle: { fontSize: 20, fontWeight: '700', color: colors.white, textAlign: 'center' },
  permissionDesc: { fontSize: 14, color: colors.gray500, textAlign: 'center', lineHeight: 20 },
  permissionBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 12,
    paddingHorizontal: spacing.xl,
  },
  permissionBtnText: { fontSize: 15, fontWeight: '700', color: colors.black },
  settingsBtn: { padding: spacing.sm },
  settingsBtnText: { fontSize: 14, color: colors.gray400 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  overlayTitle: { fontSize: 17, fontWeight: '700', color: colors.white },
  overlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  frameContainer: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: colors.primary,
    borderWidth: 3,
  },
  cornerTL: { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0, borderTopLeftRadius: 6 },
  cornerTR: { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0, borderTopRightRadius: 6 },
  cornerBL: { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0, borderBottomRightRadius: 6 },
  scanLine: {
    width: FRAME_SIZE - 16,
    height: 2,
    backgroundColor: `${colors.primary}80`,
    borderRadius: 1,
  },
  bottomBar: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  instructionText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 18,
  },
  rescanBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 10,
    paddingHorizontal: spacing.xl,
  },
  rescanText: { fontSize: 14, fontWeight: '700', color: colors.black },
});
