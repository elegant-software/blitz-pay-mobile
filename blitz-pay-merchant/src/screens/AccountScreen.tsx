import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Switch, Modal, Alert, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useLanguage } from '../lib/LanguageContext';
import { useAuth } from '../lib/auth';
import { useGeofence } from '../hooks/useGeofence';
import { colors, spacing, radius, shadow } from '../lib/theme';
import type { Language } from '../lib/translations';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export default function AccountScreen() {
  const { t, language, setLanguage } = useLanguage();
  const { user, logout, isBiometricAvailable, biometricEnrolled, enrollBiometric } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(biometricEnrolled);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const { isMonitoring, isPolling, enable: enableGeofence, disable: disableGeofence, enablePolling, disablePolling, needsSettingsForBackground, openSettings } = useGeofence();

  const handleBiometricToggle = async (value: boolean) => {
    setBiometricEnabled(value);
    if (value) await enrollBiometric();
  };

  const handleGeofenceToggle = async (value: boolean) => {
    if (!value) { await disableGeofence(); return; }
    const result = await enableGeofence();
    if (result === 'not_available') {
      Alert.alert(
        'Feature Not Available',
        'Geofencing requires a development build. It is not supported in Expo Go.',
        [{ text: 'OK' }]
      );
      return;
    }
    if (result === 'background_denied') {
      Alert.alert(
        '"Always" Location Required',
        'Branch Proximity monitoring needs "Always" location access to detect branches in the background.\n\nGo to Settings → BlitzPay Merchant → Location → Always.',
        [
          { text: 'Not Now', style: 'cancel' },
          { text: 'Open Settings', onPress: openSettings },
        ],
      );
    }
  };

  const handlePollingToggle = async (value: boolean) => {
    if (!value) { await disablePolling(); return; }
    if (isExpoGo) {
      Alert.alert(
        'Feature Not Available',
        'Location polling requires a development build. It is not supported in Expo Go.',
        [{ text: 'OK' }],
      );
      return;
    }
    const result = await enablePolling();
    if (result === 'not_available') {
      Alert.alert(
        'Feature Not Available',
        'Location polling requires a development build. It is not supported in Expo Go.',
        [{ text: 'OK' }],
      );
    } else if (result === 'error') {
      Alert.alert(
        'Polling Failed',
        'Could not start location polling. Make sure location access is enabled for this app in your device settings.',
        [
          { text: 'Open Settings', onPress: openSettings },
          { text: 'OK', style: 'cancel' },
        ],
      );
    }
  };

  const handleLogout = async () => {
    setShowLogoutModal(false);
    await logout();
  };

  const settingsSections = [
    {
      title: 'Merchant',
      rows: [
        {
          icon: 'qr-code-outline' as const,
          label: t('merchant_qr'),
          onPress: () => (navigation as any).navigate('MerchantQRCode', {}),
          showArrow: true,
        },
        {
          icon: 'wallet-outline' as const,
          label: t('payments_history'),
          onPress: () => navigation.navigate('PaymentsHistory' as never),
          showArrow: true,
        },
      ],
    },
    {
      title: t('security'),
      rows: [
        {
          icon: 'key-outline' as const,
          label: 'Change PIN',
          onPress: () => {},
          showArrow: true,
        },
        ...(isBiometricAvailable ? [{
          icon: 'finger-print' as const,
          label: t('enable_face_id'),
          onPress: () => {},
          showArrow: false,
          right: (
            <Switch
              value={biometricEnabled}
              onValueChange={handleBiometricToggle}
              trackColor={{ false: colors.gray300, true: colors.primary }}
              thumbColor={colors.white}
            />
          ),
        }] : []),
      ],
    },
    {
      title: t('settings'),
      rows: [
        {
          icon: 'language-outline' as const,
          label: t('language'),
          onPress: () => {},
          showArrow: false,
          right: (
            <View style={styles.languageToggle}>
              {(['de', 'en'] as Language[]).map((lang) => (
                <TouchableOpacity
                  key={lang}
                  style={[styles.langBtn, language === lang && styles.langBtnActive]}
                  onPress={() => setLanguage(lang)}
                >
                  <Text style={[styles.langText, language === lang && styles.langTextActive]}>
                    {lang.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ),
        },
        {
          icon: 'notifications-outline' as const,
          label: t('notifications'),
          onPress: () => {},
          showArrow: false,
          right: (
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: colors.gray300, true: colors.primary }}
              thumbColor={colors.white}
            />
          ),
        },
        {
          icon: 'location-outline' as const,
          label: t('geofence_enabled'),
          onPress: needsSettingsForBackground ? openSettings : undefined,
          showArrow: needsSettingsForBackground,
          right: needsSettingsForBackground ? (
            <Text style={styles.settingsLink}>{t('open_settings')}</Text>
          ) : (
            <Switch
              value={isMonitoring}
              onValueChange={handleGeofenceToggle}
              trackColor={{ false: colors.gray300, true: colors.primary }}
              thumbColor={colors.white}
            />
          ),
        },
        ...(isMonitoring ? [{
          icon: 'timer-outline' as const,
          label: t('geofence_polling'),
          onPress: undefined,
          showArrow: false,
          right: (
            <Switch
              value={isPolling}
              onValueChange={handlePollingToggle}
              trackColor={{ false: colors.gray300, true: colors.primary }}
              thumbColor={colors.white}
            />
          ),
        }] : []),
      ],
    },
    {
      title: t('help_support'),
      rows: [
        { icon: 'help-circle-outline' as const, label: t('help_support'), onPress: () => {}, showArrow: true },
      ],
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 90 + insets.bottom }} showsVerticalScrollIndicator={false}>
        {/* Profile */}
        <View style={styles.profileSection}>
          <View style={styles.avatarLarge}>
            <Ionicons name="storefront" size={32} color={colors.black} />
          </View>
          <Text style={styles.profileName}>{user?.name ?? 'Merchant'}</Text>
          <Text style={styles.profileEmail}>{user?.email ?? ''}</Text>
          <View style={styles.profileBadge}>
            <Ionicons name="checkmark-circle" size={12} color={colors.primary} />
            <Text style={styles.profileBadgeText}>{t('blitz_verified')}</Text>
          </View>
        </View>

        {settingsSections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={[styles.sectionCard, shadow.sm]}>
              {section.rows.map((row, idx) => (
                <TouchableOpacity
                  key={row.label}
                  style={[styles.settingRow, idx > 0 && styles.settingRowBorder]}
                  onPress={row.onPress}
                  activeOpacity={row.showArrow ? 0.7 : 1}
                >
                  <View style={styles.settingLeft}>
                    <View style={styles.settingIconBox}>
                      <Ionicons name={row.icon} size={18} color={colors.secondary} />
                    </View>
                    <Text style={styles.settingLabel}>{row.label}</Text>
                  </View>
                  {'right' in row && row.right ? row.right : (row.showArrow && (
                    <Ionicons name="chevron-forward" size={16} color={colors.gray400} />
                  ))}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutBtn} onPress={() => setShowLogoutModal(true)} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={18} color={colors.error} />
            <Text style={styles.logoutText}>{t('logout')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={showLogoutModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('logout')}</Text>
            <Text style={styles.modalDesc}>Are you sure you want to sign out?</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowLogoutModal(false)}>
                <Text style={styles.modalCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleLogout}>
                <Text style={styles.modalConfirmText}>{t('logout')}</Text>
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
  profileSection: {
    alignItems: 'center', paddingVertical: spacing.xl,
    borderBottomWidth: 1, borderBottomColor: colors.gray200,
  },
  avatarLarge: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm,
  },
  profileName: { fontSize: 20, fontWeight: '700', color: colors.onSurface },
  profileEmail: { fontSize: 14, color: colors.gray600, marginTop: 2 },
  profileBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6,
    backgroundColor: `${colors.primary}15`, borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  profileBadgeText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  section: { paddingHorizontal: spacing.md, marginTop: spacing.md },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.gray600, marginBottom: 8, paddingLeft: 4 },
  sectionCard: {
    backgroundColor: colors.background, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.gray200, overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.md,
  },
  settingRowBorder: { borderTopWidth: 1, borderTopColor: colors.gray200 },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  settingIconBox: {
    width: 32, height: 32, borderRadius: radius.sm,
    backgroundColor: `${colors.secondary}10`,
    justifyContent: 'center', alignItems: 'center',
  },
  settingLabel: { fontSize: 15, color: colors.onSurface },
  languageToggle: {
    flexDirection: 'row', backgroundColor: colors.surface,
    borderRadius: radius.full, padding: 2,
  },
  langBtn: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.full },
  langBtnActive: { backgroundColor: colors.primary },
  langText: { fontSize: 12, fontWeight: '700', color: colors.gray600 },
  langTextActive: { color: colors.black },
  settingsLink: { fontSize: 12, fontWeight: '600', color: colors.primary },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: `${colors.error}10`, borderRadius: radius.xl,
    padding: spacing.md, borderWidth: 1, borderColor: `${colors.error}20`,
  },
  logoutText: { fontSize: 15, fontWeight: '600', color: colors.error },
  modalOverlay: {
    flex: 1, backgroundColor: colors.overlayDark,
    justifyContent: 'center', alignItems: 'center', padding: spacing.lg,
  },
  modalCard: { backgroundColor: colors.background, borderRadius: radius.xxl, padding: spacing.xl, width: '100%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.onSurface, marginBottom: 8 },
  modalDesc: { fontSize: 14, color: colors.gray600, marginBottom: spacing.lg },
  modalActions: { flexDirection: 'row', gap: spacing.sm },
  modalCancel: {
    flex: 1, padding: spacing.md, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.gray300, alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: colors.onSurface },
  modalConfirm: {
    flex: 1, padding: spacing.md, borderRadius: radius.full,
    backgroundColor: colors.error, alignItems: 'center',
  },
  modalConfirmText: { fontSize: 15, fontWeight: '700', color: colors.white },
});
