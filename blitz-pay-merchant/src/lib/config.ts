function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  return value.toLowerCase() === 'true';
}

const target = process.env.EXPO_PUBLIC_BACKEND_TARGET;
if (target && target !== 'local' && target !== 'server') {
  throw new Error('EXPO_PUBLIC_BACKEND_TARGET must be local or server');
}

const apiUrl = target === 'local'
  ? process.env.EXPO_PUBLIC_LOCAL_API_URL
  : target === 'server' ? process.env.EXPO_PUBLIC_SERVER_API_URL : process.env.EXPO_PUBLIC_API_URL;
const keycloakUrl = target === 'local'
  ? process.env.EXPO_PUBLIC_LOCAL_KEYCLOAK_URL
  : target === 'server' ? process.env.EXPO_PUBLIC_SERVER_KEYCLOAK_URL : process.env.EXPO_PUBLIC_KEYCLOAK_URL;
const keycloakClientId = target === 'local'
  ? process.env.EXPO_PUBLIC_LOCAL_KEYCLOAK_CLIENT_ID
  : target === 'server' ? process.env.EXPO_PUBLIC_SERVER_KEYCLOAK_CLIENT_ID : process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID;

if (target && (!apiUrl || !keycloakUrl || !keycloakClientId)) {
  throw new Error(`Missing ${target} backend configuration in .env.local; see .env.example`);
}

export const config = {
  keycloakUrl: keycloakUrl ?? 'http://localhost:8080',
  keycloakRealm: process.env.EXPO_PUBLIC_KEYCLOAK_REALM ?? 'blitzpay',
  keycloakClientId: keycloakClientId,
  authBypass: parseBoolean(process.env.EXPO_PUBLIC_AUTH_BYPASS, false),
  apiUrl: apiUrl ?? 'https://api-blitzpay-staging.zackpay.de',
};
