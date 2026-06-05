import React, { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { storage } from './storage';
import { config } from './config';
import { observability } from './observability';
import { unregisterShopperPushToken } from './notifications/shopperPushRegistration';

// expo-local-authentication is native-only — not available on web
const LocalAuthentication = Platform.OS !== 'web'
  ? require('expo-local-authentication')
  : null;

// ─── Types ──────────────────────────────────────────────────────────────────

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresAt: number;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

export interface AuthState {
  initialized: boolean;
  authenticated: boolean;
  token: string | null;
  user: UserProfile | null;
  isBiometricAvailable: boolean;
  biometricEnrolled: boolean;
  biometricPromptDismissed: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithBiometric: () => Promise<void>;
  logout: () => Promise<void>;
  enrollBiometric: () => Promise<void>;
  unenrollBiometric: () => Promise<void>;
  dismissBiometricPrompt: () => Promise<void>;
}

// ─── Storage keys ────────────────────────────────────────────────────────────

const SESSION_KEY = 'blitzpay_session';
const BIOMETRIC_KEY = 'blitzpay_biometric_enrolled';
const PROMPT_DISMISSED_KEY = 'blitzpay_biometric_prompt_dismissed';

// ─── JWT helpers ─────────────────────────────────────────────────────────────

function decodeJwt(token: string): Record<string, unknown> {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    // atob is available in React Native 0.72+ and Hermes engine
    const json = atob(b64);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function parseUser(idToken: string): UserProfile | null {
  const c = decodeJwt(idToken);
  if (!c.sub) return null;
  return {
    id: c.sub as string,
    email: (c.email as string) ?? '',
    name: (c.name as string) ?? (c.preferred_username as string) ?? '',
    emailVerified: (c.email_verified as boolean) ?? false,
  };
}

const REQUIRED_GROUP = '/blitzpay-mobile-users';

function hasRequiredGroup(accessToken: string): boolean {
  const claims = decodeJwt(accessToken);
  const groups = claims.groups;
  if (!Array.isArray(groups)) return false;
  return (groups as string[]).includes(REQUIRED_GROUP);
}

// ─── Token refresh ───────────────────────────────────────────────────────────

async function refreshAccessToken(refreshToken: string): Promise<StoredSession | null> {
  const url = `${config.keycloakUrl}/realms/${config.keycloakRealm}/protocol/openid-connect/token`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: config.keycloakClientId,
        refresh_token: refreshToken,
      }).toString(),
    });
    if (!res.ok) return null;
    const d = await res.json() as { access_token: string; refresh_token: string; id_token: string; expires_in: number };
    return {
      accessToken: d.access_token,
      refreshToken: d.refresh_token,
      idToken: d.id_token,
      expiresAt: Date.now() + d.expires_in * 1000,
    };
  } catch {
    return null;
  }
}

// ─── Bypass user ─────────────────────────────────────────────────────────────

const BYPASS_USER: UserProfile = {
  id: 'dev-bypass',
  email: 'dev@blitzpay.local',
  name: 'Dev User',
  emailVerified: true,
};

// ─── Context ─────────────────────────────────────────────────────────────────

const defaultAuth: AuthState = {
  initialized: false,
  authenticated: false,
  token: null,
  user: null,
  isBiometricAvailable: false,
  biometricEnrolled: false,
  biometricPromptDismissed: false,
  login: async () => {},
  loginWithBiometric: async () => {},
  logout: async () => {},
  enrollBiometric: async () => {},
  unenrollBiometric: async () => {},
  dismissBiometricPrompt: async () => {},
};

const AuthContext = createContext<AuthState>(defaultAuth);
let notifySessionExpiredImpl: (() => void) | null = null;

interface AuthProviderProps {
  children: ReactNode;
  onSessionExpired?: () => void;
}

export function notifySessionExpired(): void {
  notifySessionExpiredImpl?.();
}

export function AuthProvider({ children, onSessionExpired }: AuthProviderProps) {
  const isBypass = config.authBypass;

  const [initialized, setInitialized] = useState(isBypass);
  const [authenticated, setAuthenticated] = useState(isBypass);
  const [token, setToken] = useState<string | null>(isBypass ? 'bypass-token' : null);
  const [user, setUser] = useState<UserProfile | null>(isBypass ? BYPASS_USER : null);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [biometricEnrolled, setBiometricEnrolled] = useState(false);
  const [biometricPromptDismissed, setBiometricPromptDismissed] = useState(false);
  const initStarted = useRef(false);

  useEffect(() => {
    if (!isBypass) return;
    void (async () => {
      if (LocalAuthentication) {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        setIsBiometricAvailable(hasHardware && isEnrolled);
      }
      try {
        const raw = await storage.getItem(BIOMETRIC_KEY);
        setBiometricEnrolled(raw === 'true');
        const dismissed = await storage.getItem(PROMPT_DISMISSED_KEY);
        setBiometricPromptDismissed(dismissed === 'true');
      } catch {}
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clearSessionState = React.useCallback(async () => {
    setAuthenticated(false);
    setToken(null);
    setUser(null);
    try {
      await storage.deleteItem(SESSION_KEY);
    } catch {
      // non-fatal; in-memory auth state is already cleared
    }
    onSessionExpired?.();
  }, [onSessionExpired]);

  useEffect(() => {
    notifySessionExpiredImpl = () => {
      void clearSessionState();
    };
    return () => {
      if (notifySessionExpiredImpl) {
        notifySessionExpiredImpl = null;
      }
    };
  }, [clearSessionState]);

  useEffect(() => {
    if (isBypass) return;
    if (initStarted.current) return;
    initStarted.current = true;

    void (async () => {
      // Check biometric hardware (native only)
      if (LocalAuthentication) {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        setIsBiometricAvailable(hasHardware && isEnrolled);
      }

      // Check stored biometric preference
      try {
        const raw = await storage.getItem(BIOMETRIC_KEY);
        setBiometricEnrolled(raw === 'true');
        const dismissed = await storage.getItem(PROMPT_DISMISSED_KEY);
        setBiometricPromptDismissed(dismissed === 'true');
      } catch {}

      // Restore session from secure store
      try {
        const raw = await storage.getItem(SESSION_KEY);
        if (raw) {
          const stored = JSON.parse(raw) as StoredSession;
          if (stored.expiresAt > Date.now() + 60_000) {
            setToken(stored.accessToken);
            setUser(parseUser(stored.idToken));
            setAuthenticated(true);
            setInitialized(true);
            scheduleRefresh(stored);
            return;
          } else if (stored.refreshToken) {
            const renewed = await refreshAccessToken(stored.refreshToken);
            if (renewed) {
              await storage.setItem(SESSION_KEY, JSON.stringify(renewed));
              setToken(renewed.accessToken);
              setUser(parseUser(renewed.idToken));
              setAuthenticated(true);
              setInitialized(true);
              scheduleRefresh(renewed);
              return;
            } else {
              await storage.deleteItem(SESSION_KEY);
            }
          }
        }
      } catch {}

      setInitialized(true);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function scheduleRefresh(session: StoredSession) {
    const msUntilRefresh = session.expiresAt - Date.now() - 60_000;
    if (msUntilRefresh > 0) {
      setTimeout(() => {
        void refreshAccessToken(session.refreshToken).then(async (renewed) => {
          if (renewed) {
            await storage.setItem(SESSION_KEY, JSON.stringify(renewed));
            setToken(renewed.accessToken);
            setUser(parseUser(renewed.idToken));
            scheduleRefresh(renewed);
          } else {
            await clearSessionState();
          }
        });
      }, msUntilRefresh);
    }
  }

  const login = async (email: string, password: string): Promise<void> => {
    const url = `${config.keycloakUrl}/realms/${config.keycloakRealm}/protocol/openid-connect/token`;
    console.log('[auth] login: POST', url, {
      clientId: config.keycloakClientId,
      realm: config.keycloakRealm,
    });
    let res: Response;
    const startedAt = Date.now();
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'password',
          client_id: config.keycloakClientId,
          username: email,
          password,
          scope: 'openid profile email',
        }).toString(),
      });
      console.log('[auth] login: response', res.status, `(${Date.now() - startedAt}ms)`);
    } catch (fetchErr) {
      const cause = fetchErr instanceof Error ? fetchErr : new Error(String(fetchErr));
      const detail = {
        url,
        keycloakUrl: config.keycloakUrl,
        realm: config.keycloakRealm,
        clientId: config.keycloakClientId,
        elapsedMs: Date.now() - startedAt,
        name: cause.name,
        message: cause.message,
        stack: cause.stack,
      };
      console.error('[auth] login: fetch failed — server unreachable?', detail);
      observability.warn('auth_login_network_error', detail);
      const err = new Error('network_error');
      (err as Error & { detail?: unknown }).detail = detail;
      (err as Error & { cause?: unknown }).cause = cause;
      throw err;
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string; error_description?: string };
      console.error('[auth] login failed', { status: res.status, error: body.error, description: body.error_description });
      observability.warn('auth_login_failed', {
        status: res.status,
        error: body.error ?? 'unknown',
        reason: body.error_description ?? 'n/a',
      });
      if (body.error === 'invalid_grant') throw new Error('wrong_credentials');
      if (body.error === 'unauthorized_client') throw new Error('account_locked');
      if (res.status === 401) throw new Error('wrong_credentials');
      throw new Error('network_error');
    }

    const d = await res.json() as { access_token: string; refresh_token: string; id_token: string; expires_in: number };

    if (!hasRequiredGroup(d.access_token)) {
      throw new Error('access_denied');
    }

    const session: StoredSession = {
      accessToken: d.access_token,
      refreshToken: d.refresh_token,
      idToken: d.id_token,
      expiresAt: Date.now() + d.expires_in * 1000,
    };
    try {
      await storage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (storageErr) {
      console.error('[auth] failed to persist session', storageErr);
      // Continue login even if storage fails — session will work for this app lifetime
    }
    setToken(d.access_token);
    setUser(parseUser(d.id_token));
    setAuthenticated(true);
    scheduleRefresh(session);
  };

  // Native biometric: authenticate locally then use stored refresh token
  const loginWithBiometric = async (): Promise<void> => {
    if (!LocalAuthentication) throw new Error('biometric_failed');
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Sign in to BlitzPay',
      fallbackLabel: 'Use password',
      disableDeviceFallback: false,
    });
    if (!result.success) throw new Error('biometric_failed');

    const raw = await storage.getItem(SESSION_KEY);
    if (!raw) throw new Error('no_session');

    const stored = JSON.parse(raw) as StoredSession;
    const renewed = await refreshAccessToken(stored.refreshToken);
    if (!renewed) throw new Error('network_error');

    await storage.setItem(SESSION_KEY, JSON.stringify(renewed));
    setToken(renewed.accessToken);
    setUser(parseUser(renewed.idToken));
    setAuthenticated(true);
    scheduleRefresh(renewed);
  };

  const logout = async (): Promise<void> => {
    void unregisterShopperPushToken();
    await clearSessionState();
  };

  const enrollBiometric = async (): Promise<void> => {
    await storage.setItem(BIOMETRIC_KEY, 'true');
    setBiometricEnrolled(true);
  };

  const unenrollBiometric = async (): Promise<void> => {
    await storage.deleteItem(BIOMETRIC_KEY);
    setBiometricEnrolled(false);
  };

  const dismissBiometricPrompt = async (): Promise<void> => {
    await storage.setItem(PROMPT_DISMISSED_KEY, 'true');
    setBiometricPromptDismissed(true);
  };

  return (
    <AuthContext.Provider
      value={{
        initialized,
        authenticated,
        token,
        user,
        isBiometricAvailable,
        biometricEnrolled,
        biometricPromptDismissed,
        login,
        loginWithBiometric,
        logout,
        enrollBiometric,
        unenrollBiometric,
        dismissBiometricPrompt,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
