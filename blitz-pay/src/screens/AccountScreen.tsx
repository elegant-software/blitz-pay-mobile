import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
  Modal,
  Alert,
  TextInput,
  ActivityIndicator,
  Linking,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../lib/LanguageContext';
import { useAuth } from '../lib/auth';
import { useGeofence } from '../hooks/useGeofence';
import VersionLine from '../features/app-version/components/VersionLine';
import { colors, spacing, radius, shadow } from '../lib/theme';
import { fetchLegal } from '../lib/legal';
import { authedFetch } from '../lib/api/authedFetch';
import type { Language } from '../lib/translations';
import { useNavigation } from '@react-navigation/native';
import type { RootStackNav } from '../types';
import {
  fetchShopperProfile,
  upsertShopperProfile,
  deleteShopperProfile,
  type ShopperProfileResponse,
} from '../lib/api/shopperProfile';

export default function AccountScreen() {
  const { t, language, setLanguage } = useLanguage();
  const { user, logout, isBiometricAvailable, biometricEnrolled, enrollBiometric, unenrollBiometric } = useAuth();
  const navigation = useNavigation<RootStackNav>();
  const insets = useSafeAreaInsets();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(biometricEnrolled);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const { isMonitoring, isPolling, enable: enableGeofence, disable: disableGeofence, enablePolling, disablePolling, needsSettingsForBackground, openSettings } = useGeofence();

  const [profile, setProfile] = useState<ShopperProfileResponse | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceSaving, setInvoiceSaving] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({ name: '', street: '', zip: '', city: '', country: '' });

  const loadProfile = useCallback(async () => {
    try {
      setProfileLoading(true);
      const p = await fetchShopperProfile();
      setProfile(p);
    } catch {
      // silently ignore — profile section will show empty state
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  const openInvoiceEdit = () => {
    setInvoiceForm({
      name: profile?.name ?? '',
      street: profile?.street ?? '',
      zip: profile?.zip ?? '',
      city: profile?.city ?? '',
      country: profile?.country ?? '',
    });
    setShowInvoiceModal(true);
  };

  const saveInvoiceAddress = async () => {
    if (!invoiceForm.name.trim() || !invoiceForm.street.trim() || !invoiceForm.zip.trim() || !invoiceForm.city.trim() || !invoiceForm.country.trim()) {
      Alert.alert('Missing Fields', 'All fields are required.');
      return;
    }
    try {
      setInvoiceSaving(true);
      const saved = await upsertShopperProfile({
        name: invoiceForm.name.trim(),
        street: invoiceForm.street.trim(),
        zip: invoiceForm.zip.trim(),
        city: invoiceForm.city.trim(),
        country: invoiceForm.country.trim(),
      });
      setProfile(saved);
      setShowInvoiceModal(false);
    } catch {
      Alert.alert('Error', 'Could not save invoice address. Please try again.');
    } finally {
      setInvoiceSaving(false);
    }
  };

  const handleDeleteInvoiceAddress = () => {
    Alert.alert(
      'Remove Invoice Address',
      'Your invoice address will be removed and invoices will no longer be generated for your orders.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteShopperProfile();
              setProfile(null);
            } catch {
              Alert.alert('Error', 'Could not remove invoice address. Please try again.');
            }
          },
        },
      ],
    );
  };

  const handleGeofenceToggle = async (value: boolean) => {
    if (!value) { await disableGeofence(); return; }
    const result = await enableGeofence();
    if (result === 'background_denied') {
      Alert.alert(
        '"Always" Location Required',
        'Nearby Merchant Alerts needs "Always" location access to detect merchants in the background.\n\nGo to Settings → BlitzPay → Location → Always.',
        [
          { text: 'Not Now', style: 'cancel' },
          { text: 'Open Settings', onPress: openSettings },
        ],
      );
    } else if (result === 'foreground_denied') {
      Alert.alert(
        'Location Permission Required',
        'Please allow location access so BlitzPay can detect nearby merchants.',
        [
          { text: 'Not Now', style: 'cancel' },
          { text: 'Open Settings', onPress: openSettings },
        ],
      );
    } else if (result === 'error') {
      Alert.alert(
        'Could Not Enable',
        'Nearby merchant alerts could not be started. Please try again.',
      );
    }
  };

  const handleBiometricToggle = async (value: boolean) => {
    setBiometricEnabled(value);
    if (value) {
      await enrollBiometric();
    } else {
      await unenrollBiometric();
    }
  };

  const handleDataExport = async () => {
    try {
      const res = await authedFetch('/v1/me/data-export');
      if (!res.ok) throw new Error(String(res.status));
      await Share.share({ title: t('download_my_data'), message: JSON.stringify(await res.json(), null, 2) });
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
            try { await disableGeofence(); } catch { /* nothing running */ }
            await logout();
          } catch {
            Alert.alert(t('delete_account'), t('delete_account_failed'));
          }
        },
      },
    ]);

  const handleLogout = async () => {
    setShowLogoutModal(false);
    await logout();
  };

  const settingsSections = [
    {
      title: t('my_appointments'),
      rows: [
        {
          icon: 'calendar-outline',
          label: t('my_appointments'),
          onPress: () => navigation.navigate('MyAppointments'),
          showArrow: true,
        },
      ],
    },
    {
      title: 'Account',
      rows: [
        {
          icon: 'receipt-outline',
          label: 'Invoice Address',
          onPress: openInvoiceEdit,
          showArrow: true,
          right: undefined as React.ReactNode,
        },
      ],
    },
    {
      title: t('security'),
      rows: [
        {
          icon: 'key-outline',
          label: 'Change PIN',
          onPress: () => {},
          showArrow: true,
        },
        ...(isBiometricAvailable
          ? [
              {
                icon: 'finger-print',
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
              },
            ]
          : []),
      ],
    },
    {
      title: t('settings'),
      rows: [
        {
          icon: 'language-outline',
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
          icon: 'notifications-outline',
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
          icon: 'location-outline',
          label: t('geofence_enabled'),
          onPress: needsSettingsForBackground ? openSettings : undefined,
          showArrow: needsSettingsForBackground,
          right: (
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
              onValueChange={(v: boolean) => v ? enablePolling() : disablePolling()}
              trackColor={{ false: colors.gray300, true: colors.primary }}
              thumbColor={colors.white}
            />
          ),
        }] : []),
      ],
    },
    {
      title: t('privacy'),
      rows: [
        { icon: 'document-text-outline', label: t('privacy_policy'), onPress: () => fetchLegal(language).then((l) => Linking.openURL(l.privacyUrl)).catch(() => Alert.alert(t('privacy_policy'), t('network_error'))), showArrow: true },
        { icon: 'download-outline', label: t('download_my_data'), onPress: handleDataExport, showArrow: true },
        { icon: 'trash-outline', label: t('delete_account'), onPress: handleDeleteAccount, showArrow: true },
      ],
    },
    {
      title: t('help_support'),
      rows: [
        { icon: 'help-circle-outline', label: t('help_support'), onPress: () => {}, showArrow: true },
      ],
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 90 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile */}
        <View style={styles.profileSection}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase() ?? 'U'}</Text>
            <TouchableOpacity style={styles.editAvatarBtn}>
              <Ionicons name="camera" size={12} color={colors.white} />
            </TouchableOpacity>
          </View>
          <Text style={styles.profileName}>{user?.name ?? 'User'}</Text>
          <Text style={styles.profileEmail}>{user?.email ?? ''}</Text>
          <View style={styles.profileBadge}>
            <Ionicons name="checkmark-circle" size={12} color={colors.primary} />
            <Text style={styles.profileBadgeText}>{t('blitz_verified')}</Text>
          </View>
        </View>

        {/* Settings sections */}
        {settingsSections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.rows.map((row, idx) => (
                <TouchableOpacity
                  key={row.label}
                  style={[styles.settingRow, idx > 0 && styles.settingRowBorder]}
                  onPress={row.onPress}
                  activeOpacity={row.showArrow ? 0.7 : 1}
                >
                  <View style={styles.settingLeft}>
                    <View style={styles.settingIconBox}>
                      <Ionicons name={row.icon as React.ComponentProps<typeof Ionicons>['name']} size={18} color={colors.secondary} />
                    </View>
                    <Text style={styles.settingLabel}>{row.label}</Text>
                  </View>
                  {row.right ?? (row.showArrow && (
                    <Ionicons name="chevron-forward" size={16} color={colors.gray400} />
                  ))}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Logout */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutBtn} onPress={() => setShowLogoutModal(true)} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={18} color={colors.error} />
            <Text style={styles.logoutText}>{t('logout')}</Text>
          </TouchableOpacity>
          <VersionLine />
        </View>
      </ScrollView>

      {/* Invoice Address edit modal */}
      <Modal visible={showInvoiceModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '85%' }]}>
            <View style={styles.invoiceModalHeader}>
              <Text style={styles.modalTitle}>Invoice Address</Text>
              <TouchableOpacity onPress={() => setShowInvoiceModal(false)}>
                <Ionicons name="close" size={22} color={colors.gray600} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalDesc}>This address is used automatically for invoice generation on your paid orders.</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>
              {(
                [
                  { key: 'name', label: 'Full Name', placeholder: 'Jane Doe' },
                  { key: 'street', label: 'Street & Number', placeholder: '123 Main St' },
                  { key: 'zip', label: 'Postcode', placeholder: '10115' },
                  { key: 'city', label: 'City', placeholder: 'Berlin' },
                  { key: 'country', label: 'Country', placeholder: 'DE' },
                ] as const
              ).map(({ key, label, placeholder }) => (
                <View key={key} style={styles.invoiceFieldRow}>
                  <Text style={styles.invoiceFieldLabel}>{label}</Text>
                  <TextInput
                    style={styles.invoiceFieldInput}
                    value={invoiceForm[key]}
                    onChangeText={(v) => setInvoiceForm((f) => ({ ...f, [key]: v }))}
                    placeholder={placeholder}
                    placeholderTextColor={colors.gray400}
                    autoCorrect={false}
                  />
                </View>
              ))}
            </ScrollView>
            <View style={[styles.modalActions, { marginTop: spacing.md }]}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowInvoiceModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, { backgroundColor: colors.primary }, invoiceSaving && { opacity: 0.6 }]}
                onPress={saveInvoiceAddress}
                disabled={invoiceSaving}
              >
                {invoiceSaving ? (
                  <ActivityIndicator size="small" color={colors.black} />
                ) : (
                  <Text style={[styles.modalConfirmText, { color: colors.black }]}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Logout confirmation modal */}
      <Modal visible={showLogoutModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('logout')}</Text>
            <Text style={styles.modalDesc}>Are you sure you want to sign out?</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
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
  scrollView: { flex: 1 },
  profileSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
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
  avatarText: { fontSize: 32, fontWeight: '700', color: colors.black },
  editAvatarBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.onSurface,
    justifyContent: 'center',
    alignItems: 'center',
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
  profileBadgeText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  section: { paddingHorizontal: spacing.md, marginTop: spacing.md },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.gray600, marginBottom: 8, paddingLeft: 4 },
  sectionCard: {
    backgroundColor: colors.background,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.gray200,
    overflow: 'hidden',
    ...shadow.sm,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  settingRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
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
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.onSurface, marginBottom: 8 },
  modalDesc: { fontSize: 14, color: colors.gray600, marginBottom: spacing.lg },
  modalActions: { flexDirection: 'row', gap: spacing.sm },
  modalCancel: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.gray300,
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: colors.onSurface },
  modalConfirm: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.error,
    alignItems: 'center',
  },
  modalConfirmText: { fontSize: 15, fontWeight: '600', color: colors.white },
  invoiceModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  invoiceFieldRow: { marginBottom: spacing.sm },
  invoiceFieldLabel: { fontSize: 12, fontWeight: '600', color: colors.gray600, marginBottom: 4 },
  invoiceFieldInput: {
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.onSurface,
    backgroundColor: colors.surface,
  },
});
