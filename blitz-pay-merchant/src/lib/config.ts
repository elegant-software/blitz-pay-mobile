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
};