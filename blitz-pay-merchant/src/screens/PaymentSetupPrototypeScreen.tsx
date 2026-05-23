// Three variants of merchant payment setup, switchable via ?variant=, on a throwaway prototype route.
import React, { useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLanguage } from '../lib/LanguageContext';
import { colors, radius, shadow, spacing } from '../lib/theme';
import type { RootStackNav, RootStackParamList } from '../types';

type VariantKey = 'A' | 'B' | 'C';
type PrototypeStatus = 'not_connected' | 'pending_requirements' | 'restricted' | 'enabled' | 'load_error';
type ApiAction = 'start_onboarding' | 'refresh_onboarding';

const VARIANTS: VariantKey[] = ['A', 'B', 'C'];

function readVariantFromUrl(): VariantKey | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('variant');
  return raw === 'A' || raw === 'B' || raw === 'C' ? raw : null;
}

function writeVariantToUrl(variant: VariantKey) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.set('variant', variant);
  window.history.replaceState({}, '', url.toString());
}

function getStatusKey(status: PrototypeStatus) {
  if (status === 'not_connected') return 'payment_setup_status_not_connected';
  if (status === 'pending_requirements') return 'payment_setup_status_pending_requirements';
  if (status === 'restricted') return 'payment_setup_status_restricted';
  if (status === 'enabled') return 'payment_setup_status_enabled';
  return 'payment_setup_status_load_error';
}

function getRequirementKey(status: PrototypeStatus) {
  if (status === 'pending_requirements') return 'payment_setup_requirement_pending';
  if (status === 'restricted') return 'payment_setup_requirement_restricted';
  if (status === 'enabled') return 'payment_setup_requirement_enabled';
  if (status === 'load_error') return 'payment_setup_requirement_load_error';
  return null;
}

function getCtaKey(status: PrototypeStatus) {
  if (status === 'not_connected') return 'payment_setup_cta_connect';
  if (status === 'pending_requirements') return 'payment_setup_cta_continue';
  if (status === 'restricted') return 'payment_setup_cta_review';
  if (status === 'enabled') return 'payment_setup_cta_manage';
  return 'retry';
}

function getBadgeColor(status: PrototypeStatus) {
  if (status === 'enabled') return colors.success;
  if (status === 'load_error') return colors.error;
  if (status === 'not_connected') return colors.gray600;
  return colors.warning;
}

function getApiAction(status: PrototypeStatus): ApiAction {
  if (status === 'pending_requirements' || status === 'restricted') return 'refresh_onboarding';
  return 'start_onboarding';
}

function VariantSwitcher({
  current,
  onChange,
  label,
  bottomInset,
}: {
  current: VariantKey;
  onChange: (variant: VariantKey) => void;
  label: string;
  bottomInset: number;
}) {
  const currentIndex = VARIANTS.indexOf(current);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target
        && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        onChange(VARIANTS[(currentIndex + VARIANTS.length - 1) % VARIANTS.length]);
      }
      if (event.key === 'ArrowRight') {
        onChange(VARIANTS[(currentIndex + 1) % VARIANTS.length]);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentIndex, onChange]);

  if (!__DEV__) return null;

  return (
    <View style={[styles.switcher, { bottom: bottomInset + spacing.md }]}>
      <TouchableOpacity
        style={styles.switcherButton}
        onPress={() => onChange(VARIANTS[(currentIndex + VARIANTS.length - 1) % VARIANTS.length])}
      >
        <Ionicons name="chevron-back" size={18} color={colors.white} />
      </TouchableOpacity>
      <Text style={styles.switcherLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.switcherButton}
        onPress={() => onChange(VARIANTS[(currentIndex + 1) % VARIANTS.length])}
      >
        <Ionicons name="chevron-forward" size={18} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

function StatusBadge({ text, status }: { text: string; status: PrototypeStatus }) {
  const color = getBadgeColor(status);
  return (
    <View style={[styles.badge, { backgroundColor: `${color}18` }]}>
      <View style={[styles.badgeDot, { backgroundColor: color }]} />
      <Text style={[styles.badgeText, { color }]}>{text}</Text>
    </View>
  );
}

function StateChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ProviderCard({
  status,
  statusLabel,
  body,
  note,
  ctaLabel,
  opening,
  errorText,
  successText,
  onPrimaryAction,
  variant,
}: {
  status: PrototypeStatus;
  statusLabel: string;
  body: string | null;
  note: string;
  ctaLabel: string;
  opening: boolean;
  errorText: string | null;
  successText: string | null;
  onPrimaryAction: () => void;
  variant: VariantKey;
}) {
  if (variant === 'A') {
    return (
      <LinearGradient colors={['#0D0D2B', '#17172F', '#111111']} style={styles.heroCard}>
        <View style={styles.providerTopRow}>
          <View>
            <Text style={styles.providerEyebrow}>Stripe</Text>
            <Text style={styles.providerTitle}>Stripe Connect</Text>
          </View>
          <StatusBadge text={statusLabel} status={status} />
        </View>
        <Text style={styles.providerLead}>{note}</Text>
        {body ? <Text style={styles.providerBodyOnDark}>{body}</Text> : null}
        {successText ? <Text style={styles.successBanner}>{successText}</Text> : null}
        {errorText ? <Text style={styles.errorBanner}>{errorText}</Text> : null}
        <TouchableOpacity
          style={[styles.primaryButton, opening && styles.primaryButtonDisabled]}
          disabled={opening}
          onPress={onPrimaryAction}
        >
          <Text style={styles.primaryButtonText}>{opening ? '...' : ctaLabel}</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  if (variant === 'B') {
    return (
      <View style={[styles.stepperCard, shadow.md]}>
        <View style={styles.stepperRail}>
          <View style={styles.stepNodeActive} />
          <View style={styles.stepLine} />
          <View style={[styles.stepNode, status === 'enabled' && styles.stepNodeSuccess]} />
          <View style={styles.stepLine} />
          <View style={[styles.stepNode, status === 'enabled' && styles.stepNodeSuccess]} />
        </View>
        <View style={styles.stepperContent}>
          <Text style={styles.providerTitleDark}>Stripe Connect</Text>
          <StatusBadge text={statusLabel} status={status} />
          <Text style={styles.stepperHeadline}>{note}</Text>
          {body ? <Text style={styles.providerBody}>{body}</Text> : null}
          {successText ? <Text style={styles.inlineSuccess}>{successText}</Text> : null}
          {errorText ? <Text style={styles.inlineError}>{errorText}</Text> : null}
          <TouchableOpacity
            style={[styles.secondaryButton, opening && styles.secondaryButtonDisabled]}
            disabled={opening}
            onPress={onPrimaryAction}
          >
            <Text style={styles.secondaryButtonText}>{opening ? '...' : ctaLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.opsCard, shadow.sm]}>
      <View style={styles.opsHeader}>
        <View style={styles.opsBrand}>
          <View style={styles.stripeMark}>
            <Text style={styles.stripeMarkText}>S</Text>
          </View>
          <View>
            <Text style={styles.opsTitle}>Stripe Connect</Text>
            <Text style={styles.opsSubtitle}>Merchant payment account</Text>
          </View>
        </View>
        <StatusBadge text={statusLabel} status={status} />
      </View>
      {successText ? <Text style={styles.inlineSuccess}>{successText}</Text> : null}
      {errorText ? <Text style={styles.inlineError}>{errorText}</Text> : null}
      {body ? <Text style={styles.providerBody}>{body}</Text> : null}
      <View style={styles.noteBox}>
        <Text style={styles.noteBoxLabel}>Impact</Text>
        <Text style={styles.noteBoxBody}>{note}</Text>
      </View>
      <TouchableOpacity
        style={[styles.outlineButton, opening && styles.outlineButtonDisabled]}
        disabled={opening}
        onPress={onPrimaryAction}
      >
        <Text style={styles.outlineButtonText}>{opening ? '...' : ctaLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function PaymentSetupPrototypeScreen() {
  const { t } = useLanguage();
  const navigation = useNavigation<RootStackNav>();
  const route = useRoute<RouteProp<RootStackParamList, 'PaymentSetupPrototype'>>();
  const insets = useSafeAreaInsets();
  const [variant, setVariant] = useState<VariantKey>(route.params?.variant ?? readVariantFromUrl() ?? 'A');
  const [status, setStatus] = useState<PrototypeStatus>('not_connected');
  const [opening, setOpening] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);
  const [lastApiAction, setLastApiAction] = useState<ApiAction>('start_onboarding');

  useEffect(() => {
    const queryVariant = readVariantFromUrl();
    if (queryVariant) {
      setVariant(queryVariant);
    }
  }, []);

  function changeVariant(nextVariant: VariantKey) {
    setVariant(nextVariant);
    navigation.setParams({ variant: nextVariant });
    writeVariantToUrl(nextVariant);
  }

  function resetFeedback(nextStatus?: PrototypeStatus) {
    if (nextStatus) setStatus(nextStatus);
    setOpening(false);
    setErrorText(null);
    setSuccessText(null);
    setLastApiAction(getApiAction(nextStatus ?? status));
  }

  function handlePrimaryAction() {
    setOpening(true);
    setErrorText(null);
    setSuccessText(null);
    setLastApiAction(getApiAction(status));
    setTimeout(() => {
      setOpening(false);
      if (status === 'enabled') {
        setSuccessText(t('payment_setup_connected_flash'));
        return;
      }
      setSuccessText(t('payment_setup_status_loading'));
    }, 500);
  }

  function simulateOpenError() {
    setOpening(false);
    setSuccessText(null);
    setLastApiAction(getApiAction(status));
    setErrorText(t('payment_setup_open_failed'));
  }

  function simulateReturnEnabled() {
    setStatus('enabled');
    setOpening(false);
    setErrorText(null);
    setSuccessText(t('payment_setup_connected_flash'));
  }

  function simulateRefreshUrl() {
    setOpening(false);
    setLastApiAction('refresh_onboarding');
    setSuccessText(t('payment_setup_api_refresh_hint'));
    setErrorText(null);
  }

  const statusLabel = t(getStatusKey(status));
  const requirementKey = getRequirementKey(status);
  const ctaLabel = t(getCtaKey(status));
  const note = t('payment_setup_note');
  const body = requirementKey ? t(requirementKey) : t('payment_setup_provider_stripe_body');
  const apiActionLabel = lastApiAction === 'start_onboarding'
    ? t('payment_setup_api_start')
    : t('payment_setup_api_refresh');
  const apiActionHint = lastApiAction === 'start_onboarding'
    ? t('payment_setup_api_start_hint')
    : t('payment_setup_api_refresh_hint');

  const variantLabel =
    variant === 'A'
      ? t('payment_setup_variant_a')
      : variant === 'B'
        ? t('payment_setup_variant_b')
        : t('payment_setup_variant_c');

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('payment_setup')}</Text>
        <View style={styles.headerRight}>
          <Text style={styles.prototypeTag}>PROTOTYPE</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 112 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenIntro}>{t('payment_setup_intro')}</Text>

        <View style={[styles.statePanel, shadow.sm]}>
          <Text style={styles.statePanelTitle}>{t('payment_setup_summary_title')}</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>{t('payment_setup_summary_variant')}</Text>
            <Text style={styles.summaryValue}>{variantLabel}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>{t('payment_setup_summary_provider')}</Text>
            <Text style={styles.summaryValue}>{t('payment_setup_provider_stripe')}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>{t('payment_setup_summary_status')}</Text>
            <Text style={styles.summaryValue}>{statusLabel}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>{t('payment_setup_summary_cta')}</Text>
            <Text style={styles.summaryValue}>{ctaLabel}</Text>
          </View>
        </View>

        <View style={[styles.apiCard, shadow.sm]}>
          <Text style={styles.statePanelTitle}>{t('payment_setup_api_title')}</Text>
          <View style={styles.apiEndpointRow}>
            <Text style={styles.apiEndpointLabel}>{t('payment_setup_api_start')}</Text>
            <Text style={styles.apiEndpointHint}>{t('payment_setup_api_start_hint')}</Text>
          </View>
          <View style={styles.apiEndpointRow}>
            <Text style={styles.apiEndpointLabel}>{t('payment_setup_api_refresh')}</Text>
            <Text style={styles.apiEndpointHint}>{t('payment_setup_api_refresh_hint')}</Text>
          </View>
          <View style={styles.apiGapBox}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
            <Text style={styles.apiGapText}>{t('payment_setup_api_gap')}</Text>
          </View>
          <View style={[styles.summaryRow, { paddingTop: spacing.sm }]}>
            <Text style={styles.summaryKey}>{t('payment_setup_summary_api_call')}</Text>
            <Text style={styles.summaryValue}>{apiActionLabel}</Text>
          </View>
          <Text style={styles.apiCurrentHint}>{apiActionHint}</Text>
        </View>

        <View style={styles.controlsCard}>
          <Text style={styles.controlsTitle}>{t('payment_setup_controls_title')}</Text>
          <Text style={styles.controlsLabel}>{t('payment_setup_controls_status')}</Text>
          <View style={styles.chipWrap}>
            <StateChip active={status === 'not_connected'} label={t('payment_setup_status_not_connected')} onPress={() => resetFeedback('not_connected')} />
            <StateChip active={status === 'pending_requirements'} label={t('payment_setup_status_pending_requirements')} onPress={() => resetFeedback('pending_requirements')} />
            <StateChip active={status === 'restricted'} label={t('payment_setup_status_restricted')} onPress={() => resetFeedback('restricted')} />
            <StateChip active={status === 'enabled'} label={t('payment_setup_status_enabled')} onPress={() => resetFeedback('enabled')} />
            <StateChip active={status === 'load_error'} label={t('payment_setup_status_load_error')} onPress={() => resetFeedback('load_error')} />
          </View>
          <Text style={styles.controlsLabel}>{t('payment_setup_controls_actions')}</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionButton} onPress={simulateOpenError}>
              <Text style={styles.actionButtonText}>{t('payment_setup_simulate_open_error')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={simulateReturnEnabled}>
              <Text style={styles.actionButtonText}>{t('payment_setup_simulate_return')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={simulateRefreshUrl}>
              <Text style={styles.actionButtonText}>{t('payment_setup_simulate_refresh_url')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => resetFeedback('not_connected')}>
              <Text style={styles.actionButtonText}>{t('payment_setup_simulate_reset')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ProviderCard
          status={status}
          statusLabel={statusLabel}
          body={body}
          note={note}
          ctaLabel={ctaLabel}
          opening={opening}
          errorText={errorText}
          successText={successText}
          onPrimaryAction={handlePrimaryAction}
          variant={variant}
        />
      </ScrollView>

      <VariantSwitcher
        current={variant}
        onChange={changeVariant}
        label={variantLabel}
        bottomInset={insets.bottom}
      />
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
  headerRight: { minWidth: 70, alignItems: 'flex-end' },
  prototypeTag: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.secondary,
  },
  screenIntro: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.gray700,
    marginBottom: spacing.md,
  },
  statePanel: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  apiCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  statePanelTitle: { fontSize: 13, fontWeight: '700', color: colors.onSurface, marginBottom: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: 4 },
  summaryKey: { fontSize: 12, color: colors.gray600 },
  summaryValue: { flex: 1, textAlign: 'right', fontSize: 12, fontWeight: '600', color: colors.onSurface },
  apiEndpointRow: {
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  apiEndpointLabel: { fontSize: 12, fontWeight: '700', color: colors.onSurface },
  apiEndpointHint: { fontSize: 12, lineHeight: 18, color: colors.gray700, marginTop: 4 },
  apiGapBox: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: `${colors.warning}12`,
    borderRadius: radius.lg,
    padding: spacing.sm,
  },
  apiGapText: { flex: 1, fontSize: 12, lineHeight: 18, color: colors.gray800 },
  apiCurrentHint: { fontSize: 12, lineHeight: 18, color: colors.gray700, marginTop: 4 },
  controlsCard: {
    backgroundColor: '#F8F7FF',
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E6E2FF',
    marginBottom: spacing.md,
  },
  controlsTitle: { fontSize: 15, fontWeight: '700', color: colors.onSurface, marginBottom: 8 },
  controlsLabel: { fontSize: 12, fontWeight: '600', color: colors.gray700, marginBottom: 8, marginTop: 6 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  chipActive: { backgroundColor: colors.onSurface, borderColor: colors.onSurface },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.onSurface },
  chipTextActive: { color: colors.white },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  actionButtonText: { fontSize: 12, fontWeight: '700', color: colors.onSurface },
  heroCard: {
    borderRadius: radius.xxl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  providerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  providerEyebrow: { fontSize: 12, color: '#8CA6FF', textTransform: 'uppercase', letterSpacing: 1 },
  providerTitle: { fontSize: 28, fontWeight: '800', color: colors.white },
  providerLead: { fontSize: 17, lineHeight: 24, color: colors.white, fontWeight: '600' },
  providerBodyOnDark: { fontSize: 14, lineHeight: 21, color: '#C9D0E8' },
  successBanner: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8EF0B0',
    backgroundColor: 'rgba(52,199,89,0.15)',
    padding: 12,
    borderRadius: radius.lg,
  },
  errorBanner: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFB0A9',
    backgroundColor: 'rgba(255,59,48,0.16)',
    padding: 12,
    borderRadius: radius.lg,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonDisabled: { opacity: 0.6 },
  primaryButtonText: { fontSize: 15, fontWeight: '800', color: colors.black },
  stepperCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
  },
  stepperRail: { alignItems: 'center', paddingTop: 6 },
  stepNodeActive: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.primary },
  stepNode: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.gray300 },
  stepNodeSuccess: { backgroundColor: colors.success },
  stepLine: { width: 2, flex: 1, minHeight: 34, backgroundColor: colors.gray200, marginVertical: 6 },
  stepperContent: { flex: 1, gap: 10 },
  providerTitleDark: { fontSize: 24, fontWeight: '800', color: colors.onSurface },
  stepperHeadline: { fontSize: 18, lineHeight: 24, fontWeight: '700', color: colors.onSurface },
  providerBody: { fontSize: 14, lineHeight: 20, color: colors.gray700 },
  inlineSuccess: { fontSize: 13, fontWeight: '600', color: colors.success },
  inlineError: { fontSize: 13, fontWeight: '600', color: colors.error },
  secondaryButton: {
    backgroundColor: colors.onSurface,
    borderRadius: radius.full,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  secondaryButtonDisabled: { opacity: 0.6 },
  secondaryButtonText: { fontSize: 15, fontWeight: '800', color: colors.white },
  opsCard: {
    backgroundColor: colors.white,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  opsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  opsBrand: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', flex: 1 },
  stripeMark: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: '#635BFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stripeMarkText: { color: colors.white, fontSize: 18, fontWeight: '900' },
  opsTitle: { fontSize: 20, fontWeight: '800', color: colors.onSurface },
  opsSubtitle: { fontSize: 12, color: colors.gray600 },
  noteBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 4,
  },
  noteBoxLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: colors.gray600 },
  noteBoxBody: { fontSize: 14, lineHeight: 20, color: colors.onSurface, fontWeight: '600' },
  outlineButton: {
    borderWidth: 1.5,
    borderColor: colors.onSurface,
    borderRadius: radius.full,
    paddingVertical: 14,
    alignItems: 'center',
  },
  outlineButtonDisabled: { opacity: 0.6 },
  outlineButtonText: { fontSize: 15, fontWeight: '800', color: colors.onSurface },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeDot: { width: 8, height: 8, borderRadius: 4 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  switcher: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(17,17,17,0.96)',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 8,
    ...shadow.lg,
  },
  switcherButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  switcherLabel: { flex: 1, textAlign: 'center', color: colors.white, fontSize: 13, fontWeight: '700' },
});
