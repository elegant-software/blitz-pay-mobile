import AppSwitch from '../shared/components/AppSwitch';
import PageHeading from '../shared/components/PageHeading';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useTheme } from '../lib/ThemeContext';
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Alert,
  Linking,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useLanguage } from '../lib/LanguageContext';
import { useAuth } from '../lib/auth';
import { useGeofence } from '../hooks/useGeofence';
import { authedFetch } from '../lib/api';
import { fetchLegal } from '../lib/legal';
import { spacing, radius, shadow, type ThemeColors } from '../lib/theme';
import type { Language } from '../lib/translations';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export default function AccountScreen() {
  const { mode, setMode, colors } = useTheme();
  const styles = createStyles(colors);

  const { t, language, setLanguage } = useLanguage();
  const {
    user,
    activeBranchScope,
    logout,
    isBiometricAvailable,
    biometricEnrolled,
    enrollBiometric,
    unenrollBiometric,
  } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(biometricEnrolled);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const {
    isMonitoring,
    isPolling,
    enable: enableGeofence,
    disable: disableGeofence,
    enablePolling,
    disablePolling,
    needsSettingsForBackground,
    openSettings,
  } = useGeofence();

  const handleBiometricToggle = async (value: boolean) => {
    setBiometricEnabled(value);
    if (value) {
      await enrollBiometric();
    } else {
      await unenrollBiometric();
    }
  };

  // GDPR Art. 13: say what is collected and why before the OS permission prompt.
  const confirmLocationNotice = () =>
    new Promise<boolean>((resolve) =>
      Alert.alert(
        t('location_notice_title'),
        t('location_notice_body'),
        [
          { text: t('cancel'), style: 'cancel', onPress: () => resolve(false) },
          { text: t('continue_label'), onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      ),
    );

  const handleDataExport = async () => {
    try {
      const res = await authedFetch('/v1/me/data-export');
      if (!res.ok) throw new Error(String(res.status));
      await Share.share({
        title: t('download_my_data'),
        message: JSON.stringify(await res.json(), null, 2),
      });
    } catch {
      Alert.alert(t('download_my_data'), t('data_export_failed'));
    }
  };

  const handleDeleteAccount = () =>
    Alert.alert(t('delete_account'), t('delete_account_desc'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete_account'),
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await authedFetch('/v1/me', { method: 'DELETE' });
            if (!res.ok) throw new Error(String(res.status));
            try {
              await disableGeofence();
            } catch {
              /* nothing running */
            }
            await logout();
          } catch {
            Alert.alert(t('delete_account'), t('delete_account_failed'));
          }
        },
      },
    ]);

  const handleGeofenceToggle = async (value: boolean) => {
    if (!value) {
      try {
        await disableGeofence();
      } catch {
        /* state already reset inside disable() */
      }
      return;
    }
    if (!(await confirmLocationNotice())) return;
    const result = await enableGeofence();
    if (result === 'not_available') {
      Alert.alert(
        'Feature Not Available',
        'Geofencing requires a development build. It is not supported in Expo Go.',
        [{ text: 'OK' }],
      );
    } else if (result === 'foreground_denied') {
      Alert.alert(
        'Location Permission Required',
        'Allow location access so BlitzPay Merchant can detect your active branch.',
        [
          { text: 'Not Now', style: 'cancel' },
          { text: 'Open Settings', onPress: openSettings },
        ],
      );
    } else if (result === 'background_denied') {
      Alert.alert(
        '"Always" Location Required',
        'Branch Proximity monitoring needs "Always" location access to detect branches in the background.\n\nGo to Settings → BlitzPay Merchant → Location → Always.',
        [
          { text: 'Not Now', style: 'cancel' },
          { text: 'Open Settings', onPress: openSettings },
        ],
      );
    } else if (result === 'error') {
      Alert.alert(
        'Could Not Start Monitoring',
        'Branch proximity monitoring failed to start. Please check that location access is enabled for this app.',
        [
          { text: 'Not Now', style: 'cancel' },
          { text: 'Open Settings', onPress: openSettings },
        ],
      );
    }
  };

  const handlePollingToggle = async (value: boolean) => {
    if (!value) {
      try {
        await disablePolling();
      } catch {
        /* state already reset inside disablePolling() */
      }
      return;
    }
    if (isExpoGo) {
      Alert.alert(
        'Feature Not Available',
        'Location polling requires a development build. It is not supported in Expo Go.',
        [{ text: 'OK' }],
      );
      return;
    }
    if (!(await confirmLocationNotice())) return;
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
      title: t('appearance'),
      rows: [
        {
          icon:
            mode === 'dark'
              ? ('moon-outline' as const)
              : ('sunny-outline' as const),
          label: t(mode === 'dark' ? 'theme_dark' : 'theme_light'),
          onPress: undefined,
          showArrow: false,
          right: (
            <AppSwitch
              accessibilityLabel={t('theme_dark')}
              value={mode === 'dark'}
              onValueChange={(dark) => setMode(dark ? 'dark' : 'light')}
            />
          ),
        },
      ],
    },
    {
      title: t('account_merchant'),
      rows: [
        ...(activeBranchScope?.merchantMobility === 'MOBILE'
          ? [
              {
                icon: 'radio-outline' as const,
                label: t('merchant_appearances'),
                onPress: () => navigation.navigate('Appearances' as never),
                showArrow: true,
              },
            ]
          : []),
        {
          icon: 'grid-outline' as const,
          label: t('floor_view_title'),
          onPress: () => navigation.navigate('FloorView' as never),
          showArrow: true,
        },
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
        {
          icon: 'card-outline' as const,
          label: t('card_reader_pair_title'),
          onPress: () => navigation.navigate('CardReader' as never),
          showArrow: true,
        },
      ],
    },
    {
      title: t('security'),
      rows: [
        {
          icon: 'key-outline' as const,
          label: t('change_pin'),
          onPress: () => {},
          showArrow: true,
        },
        ...(isBiometricAvailable
          ? [
              {
                icon: 'finger-print' as const,
                label: t('enable_face_id'),
                onPress: () => {},
                showArrow: false,
                right: (
                  <AppSwitch
                    accessibilityLabel={t('enable_face_id')}
                    value={biometricEnabled}
                    onValueChange={handleBiometricToggle}
                  />
                ),
              },
            ]
          : []),
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
                  style={[
                    styles.langBtn,
                    language === lang && styles.langBtnActive,
                  ]}
                  onPress={() => setLanguage(lang)}
                >
                  <Text
                    style={[
                      styles.langText,
                      language === lang && styles.langTextActive,
                    ]}
                  >
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
            <AppSwitch
              accessibilityLabel={t('notifications')}
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
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
            <AppSwitch
              accessibilityLabel={t('geofence_enabled')}
              value={isMonitoring}
              onValueChange={handleGeofenceToggle}
            />
          ),
        },
        ...(isMonitoring
          ? [
              {
                icon: 'timer-outline' as const,
                label: t('geofence_polling'),
                onPress: undefined,
                showArrow: false,
                right: (
                  <AppSwitch
                    accessibilityLabel={t('geofence_polling')}
                    value={isPolling}
                    onValueChange={handlePollingToggle}
                  />
                ),
              },
            ]
          : []),
      ],
    },
    {
      title: t('privacy'),
      rows: [
        {
          icon: 'document-text-outline' as const,
          label: t('privacy_policy'),
          onPress: () =>
            fetchLegal(language)
              .then((l) => Linking.openURL(l.privacyUrl))
              .catch(() =>
                Alert.alert(t('privacy_policy'), t('network_error')),
              ),
          showArrow: true,
        },
        {
          icon: 'download-outline' as const,
          label: t('download_my_data'),
          onPress: handleDataExport,
          showArrow: true,
        },
        {
          icon: 'trash-outline' as const,
          label: t('delete_account'),
          onPress: handleDeleteAccount,
          showArrow: true,
        },
      ],
    },
    {
      title: t('help_support'),
      rows: [
        {
          icon: 'help-circle-outline' as const,
          label: t('help_support'),
          onPress: () => {},
          showArrow: true,
        },
      ],
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingBottom: spacing.lg,
          width: '100%',
          maxWidth: 720,
          alignSelf: 'center',
        }}
        showsVerticalScrollIndicator={false}
      >
        <PageHeading
          eyebrow={`bona’me · ${t('account_merchant')}`}
          title={t('account')}
          subtitle={t('account_subtitle')}
        />
        <View style={styles.profileSection}>
          <View style={styles.avatarLarge}>
            <Ionicons name="storefront" size={32} color={colors.black} />
          </View>
          <Text style={styles.profileName}>
            {user?.name ?? t('account_merchant')}
          </Text>
          <Text style={styles.profileEmail}>{user?.email ?? ''}</Text>
          <Text style={styles.branchName}>
            {activeBranchScope?.branchName ?? t('account_merchant')}
          </Text>
          <View style={styles.profileBadge}>
            <Ionicons
              name="checkmark-circle"
              size={12}
              color={colors.primary}
            />
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
                  style={[
                    styles.settingRow,
                    idx > 0 && styles.settingRowBorder,
                  ]}
                  onPress={row.onPress}
                  activeOpacity={row.showArrow ? 0.7 : 1}
                  accessible={row.showArrow}
                >
                  <View style={styles.settingLeft}>
                    <View style={styles.settingIconBox}>
                      <Ionicons
                        name={row.icon}
                        size={18}
                        color={colors.secondary}
                      />
                    </View>
                    <Text style={styles.settingLabel}>{row.label}</Text>
                  </View>
                  {'right' in row && row.right
                    ? row.right
                    : row.showArrow && (
                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color={colors.gray400}
                        />
                      )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.logoutFooter, { marginBottom: tabBarHeight + 8 }]}>
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => setShowLogoutModal(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.error} />
          <Text style={styles.logoutText}>{t('logout')}</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('logout')}</Text>
            <Text style={styles.modalDesc}>{t('logout_confirmation')}</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={styles.modalCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={handleLogout}
              >
                <Text style={styles.modalConfirmText}>{t('logout')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    branchName: {
      color: colors.secondary,
      fontSize: 13,
      marginTop: 8,
      fontWeight: '600',
    },
    container: { flex: 1, backgroundColor: colors.background },
    scrollView: { flex: 1 },
    profileSection: {
      alignItems: 'center',
      paddingVertical: spacing.lg,
      marginHorizontal: spacing.md,
      backgroundColor: colors.cardBg,
      borderRadius: radius.xxl,
      borderWidth: 1,
      borderColor: colors.gray200,
    },
    avatarLarge: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    profileName: { fontSize: 20, fontWeight: '700', color: colors.onSurface },
    profileEmail: { fontSize: 14, color: colors.gray600, marginTop: 2 },
    profileBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 6,
      backgroundColor: `${colors.primary}15`,
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    profileBadgeText: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: '600',
    },
    section: { paddingHorizontal: spacing.md, marginTop: spacing.md },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.gray600,
      marginBottom: 8,
      paddingLeft: 4,
    },
    sectionCard: {
      backgroundColor: colors.cardBg,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.gray200,
      overflow: 'hidden',
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.md,
    },
    settingRowBorder: { borderTopWidth: 1, borderTopColor: colors.gray200 },
    settingLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flex: 1,
    },
    settingIconBox: {
      width: 32,
      height: 32,
      borderRadius: radius.sm,
      backgroundColor: `${colors.secondary}10`,
      justifyContent: 'center',
      alignItems: 'center',
    },
    settingLabel: { fontSize: 15, color: colors.onSurface },
    languageToggle: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: radius.full,
      padding: 2,
    },
    langBtn: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: radius.full,
    },
    langBtnActive: { backgroundColor: colors.primary },
    langText: { fontSize: 12, fontWeight: '700', color: colors.gray600 },
    langTextActive: { color: colors.black },
    settingsLink: { fontSize: 12, fontWeight: '600', color: colors.primary },
    logoutFooter: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.gray200,
    },
    logoutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: `${colors.error}10`,
      borderRadius: radius.xl,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: `${colors.error}20`,
    },
    logoutText: { fontSize: 15, fontWeight: '600', color: colors.error },
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
    },
    modalActions: { flexDirection: 'row', gap: spacing.sm },
    modalCancel: {
      flex: 1,
      padding: spacing.md,
      borderRadius: radius.full,
      borderWidth: 1.5,
      borderColor: colors.gray300,
      alignItems: 'center',
    },
    modalCancelText: {
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
    modalConfirmText: { fontSize: 15, fontWeight: '700', color: colors.white },
  });
