function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  return value.toLowerCase() === 'true';
}

export const config = {
  keycloakUrl: process.env.EXPO_PUBLIC_KEYCLOAK_URL ?? 'http://localhost:8080',
  keycloakRealm: process.env.EXPO_PUBLIC_KEYCLOAK_REALM ?? 'blitzpay',
  keycloakClientId: process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID,
  authBypass: parseBoolean(process.env.EXPO_PUBLIC_AUTH_BYPASS, false),
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'https://api-blitzpay-staging.zackpay.de',
  // Bump termsVersion whenever the Terms, Privacy Policy or DPA text changes; the backend stores it per signup.
  termsVersion: '2026-11-08',
  termsUrl: process.env.EXPO_PUBLIC_TERMS_URL ?? 'https://zackpay.de/terms',
  privacyUrl: process.env.EXPO_PUBLIC_PRIVACY_URL ?? 'https://zackpay.de/privacy',
};
