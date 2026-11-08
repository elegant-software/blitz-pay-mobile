import React from 'react';
import { Image } from 'expo-image';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useLanguage } from '../lib/LanguageContext';
import { useNearbyMerchants } from '../features/nearby-merchants/hooks/useNearbyMerchants';
import { colors, spacing, radius, shadow } from '../lib/theme';
import type { RootStackNav } from '../types';

const APPEARANCE_CARD_COLORS = ['#0E7490', '#1D4ED8', '#C2410C'];

const QUICK_ACTIONS = [
  { key: 'my_qr', icon: 'qr-code-outline', screen: 'MyQRCode' as const },
  { key: 'scan_qr', icon: 'scan-outline', screen: 'QRScanner' as const },
  { key: 'table_code_quick_action', icon: 'restaurant-outline', screen: 'TableCheckIn' as const },
  { key: 'notifications', icon: 'notifications-outline', screen: 'Notifications' as const },
];

export default function ExploreScreen() {
  const { language, t } = useLanguage();
  const navigation = useNavigation<RootStackNav>();
  const insets = useSafeAreaInsets();
  const {
    merchants,
    appearances,
    loading,
    appearanceLoading,
    errorKey,
    appearanceErrorKey,
    locationLabel,
    permissionDenied,
    refreshAppearances,
    refreshNearby,
  } = useNearbyMerchants();

  const formatAppearanceWindow = (startTime: string, endTime: string) => {
    const formatter = new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `${formatter.format(new Date(startTime))} - ${formatter.format(new Date(endTime))}`;
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 90 + insets.bottom }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerLeft}>
          <Image
            source={{ uri: 'https://i.pravatar.cc/150?img=47' }}
            style={styles.avatar}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
          <View>
            <Text style={styles.greeting}>{t('happening_now')}</Text>
            <Text style={styles.locationLabel}>📍 {loading ? t('nearby_merchants_loading') : locationLabel}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.brandMark}>⚡ BlitzPay</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Notifications')}
            style={styles.notifBtn}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.onSurface} />
            <View style={styles.notifDot} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color={colors.gray500} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('search_placeholder')}
          placeholderTextColor={colors.gray500}
        />
      </View>

      <View style={styles.quickActions}>
        {QUICK_ACTIONS.map((action) => (
          <TouchableOpacity
            key={action.key}
            style={styles.quickAction}
            onPress={() => navigation.navigate(action.screen)}
            activeOpacity={0.75}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name={action.icon as React.ComponentProps<typeof Ionicons>['name']} size={22} color={colors.primary} />
            </View>
            <Text style={styles.quickActionLabel}>{t(action.key as 'my_qr' | 'scan_qr' | 'notifications')}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('happening_now')}</Text>
        <TouchableOpacity onPress={refreshAppearances}>
          <Text style={styles.seeAll}>{t('retry')}</Text>
        </TouchableOpacity>
      </View>

      {appearanceLoading ? (
        <View style={styles.stateCard}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateTitle}>{t('happening_now_loading')}</Text>
        </View>
      ) : appearanceErrorKey ? (
        <View style={styles.stateCard}>
          <Ionicons name="radio-outline" size={24} color={colors.secondary} />
          <Text style={styles.stateTitle}>
            {permissionDenied ? t('location_permission_required') : t(appearanceErrorKey as Parameters<typeof t>[0])}
          </Text>
          <Text style={styles.stateBody}>
            {permissionDenied ? t('location_permission_body') : t('happening_now_empty_body')}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={refreshAppearances}>
            <Text style={styles.retryButtonText}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : appearances.length === 0 ? (
        <View style={styles.stateCard}>
          <Ionicons name="radio-outline" size={24} color={colors.secondary} />
          <Text style={styles.stateTitle}>{t('happening_now_empty_title')}</Text>
          <Text style={styles.stateBody}>{t('happening_now_empty_body')}</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.eventsRow}>
          {appearances.map((appearance, index) => (
            <TouchableOpacity
              key={appearance.appearanceId}
              style={[
                styles.eventCard,
                { backgroundColor: APPEARANCE_CARD_COLORS[index % APPEARANCE_CARD_COLORS.length] },
              ]}
              activeOpacity={0.85}
              onPress={() =>
                navigation.navigate('Merchant', {
                  merchantId: appearance.merchantId,
                  merchantName: appearance.merchantName,
                  branchId: appearance.branchId,
                  branchName: appearance.branchName,
                  distanceMeters: appearance.distanceMeters,
                })
              }
            >
              <View style={styles.eventIconRow}>
                <View style={styles.eventIconBadge}>
                  <Ionicons name="radio-outline" size={18} color={colors.white} />
                </View>
                <View style={styles.eventPendingBadge}>
                  <Text style={styles.eventPendingText}>{t('live_now')}</Text>
                </View>
              </View>
              <Text style={styles.eventTitle} numberOfLines={2}>{appearance.branchName}</Text>
              <Text style={styles.eventVenue} numberOfLines={1}>{appearance.merchantName}</Text>
              <View style={styles.eventMetaStack}>
                <Text style={styles.eventMetaText}>{formatAppearanceWindow(appearance.startTime, appearance.endTime)}</Text>
                {appearance.distanceLabel ? <Text style={styles.eventMetaText}>{appearance.distanceLabel}</Text> : null}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('nearby_merchants')}</Text>
        <TouchableOpacity onPress={refreshNearby}>
          <Text style={styles.seeAll}>{t('retry')}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.stateCard}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateTitle}>{t('nearby_merchants_loading')}</Text>
        </View>
      ) : errorKey ? (
        <View style={styles.stateCard}>
          <Ionicons name="location-outline" size={24} color={colors.secondary} />
          <Text style={styles.stateTitle}>
            {permissionDenied ? t('location_permission_required') : t(errorKey as Parameters<typeof t>[0])}
          </Text>
          <Text style={styles.stateBody}>
            {permissionDenied ? t('location_permission_body') : t('nearby_merchants_empty_body')}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={refreshNearby}>
            <Text style={styles.retryButtonText}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : merchants.length === 0 ? (
        <View style={styles.stateCard}>
          <Ionicons name="storefront-outline" size={24} color={colors.secondary} />
          <Text style={styles.stateTitle}>{t('nearby_merchants_empty_title')}</Text>
          <Text style={styles.stateBody}>{t('nearby_merchants_empty_body')}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refreshNearby}>
            <Text style={styles.retryButtonText}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        merchants.map((merchant) => (
          <TouchableOpacity
            key={merchant.merchantId}
            style={styles.merchantCard}
            onPress={() =>
              navigation.navigate('Merchant', {
                merchantId: merchant.merchantId,
                merchantName: merchant.merchantName,
                merchantLogoUrl: merchant.logoUrl,
                distanceMeters: merchant.distanceMeters,
              })
            }
            activeOpacity={0.85}
          >
            <View style={styles.merchantIconBox}>
              {merchant.logoUrl ? (
                <Image source={{ uri: merchant.logoUrl }} style={styles.merchantLogo} contentFit="contain" cachePolicy="memory-disk" />
              ) : (
                <Ionicons name="storefront-outline" size={24} color={colors.secondary} />
              )}
            </View>
            <View style={styles.merchantInfo}>
              <View style={styles.merchantNameRow}>
                <Text style={styles.merchantName}>{merchant.displayName}</Text>
                <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
              </View>
              <Text style={styles.merchantCategory}>{merchant.merchantName}</Text>
              <View style={styles.merchantMeta}>
                <Ionicons name="navigate-outline" size={12} color={colors.gray600} />
                <Text style={styles.merchantDistance}>{merchant.distanceLabel}</Text>
                <Text style={styles.merchantDot}>·</Text>
                <Text style={styles.merchantOpen}>
                  {t('merchant_radius_meters', { count: merchant.geofenceRadiusMeters })}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  greeting: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.onSurface,
  },
  locationLabel: {
    fontSize: 12,
    color: colors.gray600,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandMark: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.3,
  },
  notifBtn: {
    position: 'relative',
    padding: 4,
  },
  notifDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.gray200,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.onSurface,
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  quickActionIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow.sm,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray700,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.onSurface,
  },
  seeAll: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  eventsRow: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  eventCard: {
    width: 210,
    borderRadius: radius.xxl,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.md,
  },
  eventIconRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  eventVenue: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
  },
  eventMetaStack: {
    gap: 4,
  },
  eventMetaText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  eventPendingBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  eventPendingText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  merchantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.gray200,
    ...shadow.sm,
  },
  merchantIconBox: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: `${colors.secondary}12`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    overflow: 'hidden',
  },
  merchantLogo: {
    width: 52,
    height: 52,
    borderRadius: 18,
  },
  merchantInfo: {
    flex: 1,
  },
  merchantNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  merchantName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.onSurface,
  },
  merchantCategory: {
    fontSize: 12,
    color: colors.gray600,
    marginBottom: 6,
  },
  merchantMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  merchantDistance: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray700,
  },
  merchantDot: {
    fontSize: 12,
    color: colors.gray500,
  },
  merchantOpen: {
    fontSize: 12,
    color: colors.gray600,
  },
  stateCard: {
    marginHorizontal: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
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
  retryButton: {
    marginTop: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  retryButtonText: {
    color: colors.black,
    fontWeight: '700',
  },
});
