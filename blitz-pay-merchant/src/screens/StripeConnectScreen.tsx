import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../lib/auth';
import { authedFetch } from '../lib/api';
import { useLanguage } from '../lib/LanguageContext';
import { colors, radius, shadow, spacing } from '../lib/theme';
import type { RootStackNav } from '../types';

const API_VERSION = 'v1';

type ConnectStatus = 'loading' | 'not_connected' | 'verifying' | 'connected' | 'error';

type StripeConnectStatusResponse = {
  connected: boolean;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
};

async function fetchStripeConnectStatus(merchantId: string): Promise<StripeConnectStatusResponse | null> {
  try {
    const url = `/${API_VERSION}/merchants/${merchantId}/stripe-connect/status`;
    console.log('[SC] GET', url);
    const res = await authedFetch(url);
    const text = await res.text();
    console.log('[SC] HTTP', res.status, '|', text);
    if (!res.ok) return null;
    const raw = JSON.parse(text) as Record<string, unknown>;
    console.log('[SC] keys:', Object.keys(raw).join(','), '| values:', JSON.stringify(raw));
    return {
      connected: Boolean(raw.connected),
      chargesEnabled: Boolean(raw.chargesEnabled ?? raw.charges_enabled),
      detailsSubmitted: Boolean(raw.detailsSubmitted ?? raw.details_submitted),
    };
  } catch (e) {
    console.log('[SC] error', e);
    return null;
  }
}

async function fetchMerchantStripeStatus(merchantId: string): Promise<ConnectStatus> {
  const data = await fetchStripeConnectStatus(merchantId);
  if (!data) return 'error';
  if (data.connected && data.chargesEnabled) return 'connected';
  if (data.detailsSubmitted) return 'verifying';
  return 'not_connected';
}

async function pollUntilConnected(
  merchantId: string,
  isCancelled: () => boolean,
  onConnected: () => void,
): Promise<void> {
  const INTERVAL_MS = 4000;
  const MAX_ATTEMPTS = 8; // ~32 seconds total
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    await new Promise<void>((r) => setTimeout(r, INTERVAL_MS));
    if (isCancelled()) return;
    const data = await fetchStripeConnectStatus(merchantId);
    if (data?.connected && data.chargesEnabled) {
      onConnected();
      return;
    }
  }
  // timed out — stay in verifying so the user can tap "Continue setup" to refresh
}

type OnboardingResult =
  | { url: string; error: null; log: string }
  | { url: null; error: string; log: string };

function extractOnboardingUrl(data: Record<string, unknown>): string | null {
  // try common field names backends use for this
  for (const key of ['url', 'onboardingUrl', 'accountLinkUrl', 'link', 'redirectUrl']) {
    const val = data[key];
    if (typeof val === 'string' && val.startsWith('https://')) return val;
  }
  return null;
}

async function parseOnboardingResponse(res: Response): Promise<OnboardingResult> {
  const text = await res.text();
  const preview = text.slice(0, 300);
  console.log('[StripeConnect] raw:', preview);
  if (text.trim().startsWith('https://')) {
    return { url: text.trim(), error: null, log: `plain-url: ${text.trim().slice(0, 80)}` };
  }
  try {
    const data = JSON.parse(text) as unknown;
    if (typeof data === 'string' && data.startsWith('https://')) {
      return { url: data, error: null, log: `json-string: ${data.slice(0, 80)}` };
    }
    if (data && typeof data === 'object') {
      const url = extractOnboardingUrl(data as Record<string, unknown>);
      if (url) return { url, error: null, log: `json-field: ${url.slice(0, 80)}` };
    }
    return { url: null, error: preview, log: `no-url-found keys=${Object.keys(data as object ?? {}).join(',')}` };
  } catch {
    return { url: null, error: `Non-JSON: ${preview}`, log: `parse-error` };
  }
}

async function apiStartOnboarding(merchantId: string): Promise<OnboardingResult> {
  const res = await authedFetch(
    `/${API_VERSION}/merchants/${merchantId}/stripe-connect`,
    { method: 'POST' },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { url: null, error: `HTTP ${res.status}: ${body.slice(0, 300)}`, log: `HTTP ${res.status}` };
  }
  return parseOnboardingResponse(res);
}

async function apiRefreshOnboarding(merchantId: string): Promise<OnboardingResult> {
  const res = await authedFetch(`/${API_VERSION}/merchants/${merchantId}/stripe-connect/refresh`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { url: null, error: `HTTP ${res.status}: ${body.slice(0, 300)}`, log: `HTTP ${res.status}` };
  }
  return parseOnboardingResponse(res);
}

function StatusBadge({ status }: { status: ConnectStatus }) {
  const { t } = useLanguage();
  if (status === 'loading') return null;

  const configs: Record<Exclude<ConnectStatus, 'loading'>, { color: string; label: string }> = {
    not_connected: { color: colors.gray600, label: t('payment_setup_status_not_connected') },
    verifying: { color: colors.warning, label: t('payment_setup_status_loading') },
    connected: { color: colors.success, label: t('payment_setup_status_enabled') },
    error: { color: colors.error, label: t('payment_setup_status_load_error') },
  };

  const { color, label } = configs[status];
  return (
    <View style={[styles.badge, { backgroundColor: `${color}18` }]}>
      <View style={[styles.badgeDot, { backgroundColor: color }]} />
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export default function StripeConnectScreen() {
  const { t } = useLanguage();
  const { activeBranchScope } = useAuth();
  const merchantId = activeBranchScope?.merchantId ?? null;
  const navigation = useNavigation<RootStackNav>();
  const insets = useSafeAreaInsets();

  const [status, setStatus] = useState<ConnectStatus>('loading');
  const [actionLoading, setActionLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const pollCancelledRef = useRef(false);

  console.log('[SC] merchantId from scope:', merchantId);

  const loadStatus = useCallback(async () => {
    if (!merchantId) { setStatus('error'); return; }
    setStatus('loading');
    const fetched = await fetchMerchantStripeStatus(merchantId);
    console.log('[SC] loadStatus result:', fetched);
    setStatus(fetched);
  }, [merchantId]);

  useEffect(() => {
    void loadStatus();
    return () => { pollCancelledRef.current = true; };
  }, [loadStatus]);

  function startPolling(id: string) {
    pollCancelledRef.current = false;
    void pollUntilConnected(
      id,
      () => pollCancelledRef.current,
      () => setStatus('connected'),
    );
  }


  async function handleConnect() {
    if (!merchantId) return;
    setActionLoading(true);
    setErrorText(null);
    try {
      const result = status === 'verifying'
        ? await apiRefreshOnboarding(merchantId)
        : await apiStartOnboarding(merchantId);
      if (result.error !== null) {
        setActionLoading(false);
        setErrorText(result.error);
        return;
      }
      await WebBrowser.openBrowserAsync(result.url, {
        dismissButtonStyle: 'close',
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });
      // Browser closed — stay in verifying and poll silently until webhook arrives
      setActionLoading(false);
      setStatus('verifying');
      startPolling(merchantId);
    } catch (err) {
      setActionLoading(false);
      setErrorText(err instanceof Error ? err.message : String(err));
    }
  }

  function ctaLabel(): string {
    if (actionLoading) return '…';
    if (status === 'connected') return t('payment_setup_cta_manage');
    if (status === 'verifying') return t('payment_setup_cta_continue');
    return t('payment_setup_cta_connect');
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('payment_setup')}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, shadow.md]}>
          <View style={styles.cardHeader}>
            <View style={styles.stripeBrand}>
              <View style={styles.stripeMark}>
                <Text style={styles.stripeMarkText}>S</Text>
              </View>
              <View style={styles.brandText}>
                <Text style={styles.cardTitle}>{t('payment_setup_provider_stripe')}</Text>
                <Text style={styles.cardSubtitle}>{t('payment_setup_provider_stripe_body')}</Text>
              </View>
            </View>
            <StatusBadge status={status} />
          </View>

          {status === 'loading' && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>{t('payment_setup_status_loading')}</Text>
            </View>
          )}

          {status === 'verifying' && (
            <View style={styles.infoBox}>
              <Ionicons name="time-outline" size={16} color={colors.warning} />
              <Text style={styles.infoBoxText}>{t('payment_setup_requirement_pending')}</Text>
            </View>
          )}

          {status === 'connected' && (
            <View style={styles.infoBox}>
              <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
              <Text style={styles.infoBoxText}>{t('payment_setup_requirement_enabled')}</Text>
            </View>
          )}

          {status === 'not_connected' && (
            <View style={styles.noteBox}>
              <Text style={styles.noteBoxLabel}>Impact</Text>
              <Text style={styles.noteBoxBody}>{t('payment_setup_note')}</Text>
            </View>
          )}

          {errorText != null && (
            <Text style={styles.errorText}>{errorText}</Text>
          )}

          {status !== 'loading' && status !== 'error' && (
            <TouchableOpacity
              style={[
                styles.ctaButton,
                (actionLoading || status === 'connected') && styles.ctaButtonDisabled,
              ]}
              disabled={actionLoading || status === 'connected'}
              onPress={handleConnect}
            >
              {actionLoading
                ? <ActivityIndicator size="small" color={colors.black} />
                : <Text style={styles.ctaButtonText}>{ctaLabel()}</Text>}
            </TouchableOpacity>
          )}

          {status === 'error' && (
            <TouchableOpacity style={styles.retryButton} onPress={loadStatus}>
              <Text style={styles.retryButtonText}>{t('retry')}</Text>
            </TouchableOpacity>
          )}

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.onSurface },
  headerRight: { width: 40 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  stripeBrand: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', flex: 1 },
  stripeMark: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: '#635BFF',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  stripeMarkText: { color: colors.white, fontSize: 20, fontWeight: '900' },
  brandText: { flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: colors.onSurface },
  cardSubtitle: { fontSize: 13, lineHeight: 18, color: colors.gray600, marginTop: 2 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  loadingText: { fontSize: 14, color: colors.gray600 },
  infoBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  infoBoxText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.onSurface },
  noteBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 4,
  },
  noteBoxLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: colors.gray600 },
  noteBoxBody: { fontSize: 14, lineHeight: 20, color: colors.onSurface, fontWeight: '600' },
  errorText: { fontSize: 13, fontWeight: '600', color: colors.error },
  ctaButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  ctaButtonDisabled: { opacity: 0.6 },
  ctaButtonText: { fontSize: 15, fontWeight: '800', color: colors.black },
  retryButton: {
    borderWidth: 1.5,
    borderColor: colors.onSurface,
    borderRadius: radius.full,
    paddingVertical: 14,
    alignItems: 'center',
  },
  retryButtonText: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexShrink: 0,
  },
  badgeDot: { width: 8, height: 8, borderRadius: 4 },
  badgeText: { fontSize: 12, fontWeight: '700' },
});
