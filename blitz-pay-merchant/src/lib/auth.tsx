import React, { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { storage } from './storage';
import { config } from './config';

const LocalAuthentication = Platform.OS !== 'web'
  ? require('expo-local-authentication')
  : null;

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresAt: number;
}

export interface UserProfile {
  id: string;
  // TODO: Re-enable claim-based merchant scoping after the product flow stops relying on location-only resolution.
  merchantId: string | null;
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
  login: (email: string, password: string) => Promise<void>;
  loginWithBiometric: () => Promise<void>;
  logout: () => Promise<void>;
  enrollBiometric: () => Promise<void>;
}

const SESSION_KEY = 'blitzpay_merchant_session';
const BIOMETRIC_KEY = 'blitzpay_merchant_biometric_enrolled';

function decodeJwt(token: string): Record<string, unknown> {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b64)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function readStringClaim(claims: Record<string, unknown>, key: string): string | null {
  const value = claims[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function resolveMerchantId(claims: Record<string, unknown>): string | null {
  const directKeys = [
    'merchantId',
    'merchant_id',
    'merchant-id',
    'merchant',
    'merchant_id_claim',
  ];

  for (const key of directKeys) {
    const value = readStringClaim(claims, key);
    if (value) return value;
  }

  const merchantObject = claims.merchant;
  if (merchantObject && typeof merchantObject === 'object') {
    const nestedId = readStringClaim(merchantObject as Record<string, unknown>, 'id');
    if (nestedId) return nestedId;
  }

  return null;
}

function parseUser(idToken: string): UserProfile | null {
  const c = decodeJwt(idToken);
  if (!c.sub) return null;
  return {
    id: c.sub as string,
    merchantId: resolveMerchantId(c),
    email: (c.email as string) ?? '',
    name: (c.name as string) ?? (c.preferred_username as string) ?? '',
    emailVerified: (c.email_verified as boolean) ?? false,
  };
}

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

const BYPASS_USER: UserProfile = {
  id: 'dev-bypass',
  merchantId: 'dev-bypass-merchant',
  email: 'merchant@blitzpay.local',
  name: 'Demo Merchant',
  emailVerified: true,
};

const defaultAuth: AuthState = {
  initialized: false,
  authenticated: false,
  token: null,
  user: null,
  isBiometricAvailable: false,
  biometricEnrolled: false,
  login: async () => {},
  loginWithBiometric: async () => {},
  logout: async () => {},
  enrollBiometric: async () => {},
};

const AuthContext = createContext<AuthState>(defaultAuth);

export function AuthProvider({ children }: { children: ReactNode }) {
  const isBypass = config.authBypass;

  const [initialized, setInitialized] = useState(isBypass);
  const [authenticated, setAuthenticated] = useState(isBypass);
  const [token, setToken] = useState<string | null>(isBypass ? 'bypass-token' : null);
  const [user, setUser] = useState<UserProfile | null>(isBypass ? BYPASS_USER : null);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [biometricEnrolled, setBiometricEnrolled] = useState(false);
  const initStarted = useRef(false);

  useEffect(() => {
    if (isBypass) return;
    if (initStarted.current) return;
    initStarted.current = true;

    void (async () => {
      if (LocalAuthentication) {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        setIsBiometricAvailable(hasHardware && isEnrolled);
      }
      try {
        const raw = await storage.getItem(BIOMETRIC_KEY);
        setBiometricEnrolled(raw === 'true');
      } catch {}

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
            }
            await storage.deleteItem(SESSION_KEY);
          }
        }
      } catch {}

      setInitialized(true);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function scheduleRefresh(session: StoredSession) {
    const ms = session.expiresAt - Date.now() - 60_000;
    if (ms > 0) {
      setTimeout(() => {
        void refreshAccessToken(session.refreshToken).then(async (renewed) => {
          if (renewed) {
            await storage.setItem(SESSION_KEY, JSON.stringify(renewed));
            setToken(renewed.accessToken);
            setUser(parseUser(renewed.idToken));
            scheduleRefresh(renewed);
          } else {
            await storage.deleteItem(SESSION_KEY);
            setAuthenticated(false);
            setToken(null);
            setUser(null);
          }
        });
      }, ms);
    }
  }

  const login = async (email: string, password: string): Promise<void> => {
    const url = `${config.keycloakUrl}/realms/${config.keycloakRealm}/protocol/openid-connect/token`;
    let res: Response;
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
    } catch {
      throw new Error('network_error');
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      if (body.error === 'invalid_grant' || res.status === 401) throw new Error('wrong_credentials');
      if (body.error === 'unauthorized_client') throw new Error('account_locked');
      throw new Error('network_error');
    }
    const d = await res.json() as { access_token: string; refresh_token: string; id_token: string; expires_in: number };
    const session: StoredSession = {
      accessToken: d.access_token,
      refreshToken: d.refresh_token,
      idToken: d.id_token,
      expiresAt: Date.now() + d.expires_in * 1000,
    };
    await storage.setItem(SESSION_KEY, JSON.stringify(session));
    setToken(d.access_token);
    setUser(parseUser(d.id_token));
    setAuthenticated(true);
    scheduleRefresh(session);
  };

  const loginWithBiometric = async (): Promise<void> => {
    if (!LocalAuthentication) throw new Error('biometric_failed');
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Sign in to BlitzPay Merchant',
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
    await storage.deleteItem(SESSION_KEY);
    setAuthenticated(false);
    setToken(null);
    setUser(null);
  };

  const enrollBiometric = async (): Promise<void> => {
    await storage.setItem(BIOMETRIC_KEY, 'true');
    setBiometricEnrolled(true);
  };

  return (
    <AuthContext.Provider value={{
      initialized, authenticated, token, user, isBiometricAvailable, biometricEnrolled,
      login, loginWithBiometric, logout, enrollBiometric,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
