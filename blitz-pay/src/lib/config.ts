function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  return value.toLowerCase() === 'true';
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (value == null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function joinUrl(base: string, path: string): string {
  const trimmedBase = base.replace(/\/+$/, '');
  const trimmedPath = path.startsWith('/') ? path : `/${path}`;
  return `${trimmedBase}${trimmedPath}`;
}

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'https://api-blitzpay-staging.zackpay.de';

export const config = {
  keycloakUrl: process.env.EXPO_PUBLIC_KEYCLOAK_URL ?? 'http://localhost:8080',
  keycloakRealm: process.env.EXPO_PUBLIC_KEYCLOAK_REALM ?? 'blitzpay-customers',
  keycloakClientId: process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID ?? 'blitzpay-mobile',
  authBypass: process.env.EXPO_PUBLIC_AUTH_BYPASS === 'true',
  stripePublishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
  apiUrl,
  /** Public storefront base URL; Table Links are `${storefrontUrl}/t/{code}`. Unset disables universal/app links. */
  storefrontUrl: process.env.EXPO_PUBLIC_STOREFRONT_URL?.replace(/\/+$/, '') || null,
  trueLayerPaymentsUrl: joinUrl(apiUrl, '/v1/payments/request'),
  trueLayerEnvironment: process.env.EXPO_PUBLIC_TRUELAYER_ENVIRONMENT ?? 'sandbox',
  trueLayerRedirectScheme: process.env.EXPO_PUBLIC_TRUELAYER_REDIRECT_SCHEME ?? 'blitzpay',
  trueLayerRedirectHost: process.env.EXPO_PUBLIC_TRUELAYER_REDIRECT_HOST ?? 'payments',
  trueLayerRedirectPath: process.env.EXPO_PUBLIC_TRUELAYER_REDIRECT_PATH ?? 'truelayer',
  trueLayerPreferredCountryCode: process.env.EXPO_PUBLIC_TRUELAYER_COUNTRY_CODE ?? 'GB',
  observabilityEnabled: parseBoolean(process.env.EXPO_PUBLIC_OBSERVABILITY_ENABLED, false),
  observabilityEnvironment: process.env.EXPO_PUBLIC_OBSERVABILITY_ENVIRONMENT ?? 'development',
  observabilityServiceName: process.env.EXPO_PUBLIC_OBSERVABILITY_SERVICE_NAME ?? 'blitzpay-mobile',
  observabilityServiceVersion: process.env.EXPO_PUBLIC_OBSERVABILITY_SERVICE_VERSION ?? '1.0.0',
  observabilityIngestPath: process.env.EXPO_PUBLIC_OBSERVABILITY_INGEST_PATH ?? '/api/observability/mobile-logs',
  observabilitySampleRate: Math.min(1, Math.max(0, parseNumber(process.env.EXPO_PUBLIC_OBSERVABILITY_SAMPLE_RATE, 1))),
  observabilityCaptureConsole: parseBoolean(process.env.EXPO_PUBLIC_OBSERVABILITY_CAPTURE_CONSOLE, true),
};
