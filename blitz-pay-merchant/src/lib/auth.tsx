import React, { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { storage } from './storage';
import { config } from './config';
import { observability } from './observability';

const LocalAuthentication = Platform.OS !== 'web'
  ? require('expo-local-authentication')
  : null;

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresAt: number;
}

export interface BranchMembership {
  groupPath: string;
  merchantId: string;
  branchId: string;
}

export interface ActiveBranchScope {
  merchantId: string;
  branchId: string;
  branchName: string | null;
  source: 'branch_membership';
  status: 'resolved';
}

export interface UserProfile {
  id: string;
  merchantId: string | null;
  email: string;
  name: string;
  emailVerified: boolean;
  branchMemberships: BranchMembership[];
  activeBranchId: string | null;
}

export interface AuthState {
  initialized: boolean;
  authenticated: boolean;
  token: string | null;
  user: UserProfile | null;
  activeBranchScope: ActiveBranchScope | null;
  branchScopeError: string | null;
  isBiometricAvailable: boolean;
  biometricEnrolled: boolean;
  retryBranchScope: () => Promise<void>;
  selectActiveBranch: (branchId: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithBiometric: () => Promise<void>;
  logout: () => Promise<void>;
  enrollBiometric: () => Promise<void>;
}

const SESSION_KEY = 'blitzpay_merchant_session';
const BIOMETRIC_KEY = 'blitzpay_merchant_biometric_enrolled';
const ACTIVE_BRANCH_KEY = 'blitzpay_merchant_active_branch_id';
const BRANCH_GROUP_PATTERN = /^\/merchants\/merchant_([^/]+)\/branch_([^/]+)$/;

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

function readStringArrayClaim(claims: Record<string, unknown>, key: string): string[] {
  const value = claims[key];
  if (typeof value === 'string' && value.trim()) return [value];
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
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

function parseBranchMemberships(claims: Record<string, unknown>): { memberships: BranchMembership[]; invalidCount: number } {
  const groups = [
    ...readStringArrayClaim(claims, 'access_group'),
    ...readStringArrayClaim(claims, 'groups'),
  ];
  const seen = new Set<string>();
  const memberships: BranchMembership[] = [];
  let invalidCount = 0;

  for (const groupPath of groups) {
    const match = groupPath.match(BRANCH_GROUP_PATTERN);
    if (!match) {
      if (groupPath.startsWith('/merchants/')) invalidCount += 1;
      continue;
    }

    const [, merchantId, branchId] = match;
    const key = `${merchantId}:${branchId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    memberships.push({
      groupPath,
      merchantId,
      branchId,
    });
  }

  return { memberships, invalidCount };
}

function buildBranchScope(
  memberships: BranchMembership[],
  activeBranchId: string | null,
): { activeBranchId: string | null; activeBranchScope: ActiveBranchScope | null; errorKey: string | null } {
  if (memberships.length === 0) {
    return { activeBranchId: null, activeBranchScope: null, errorKey: 'merchant_branch_access_missing' };
  }

  const selectedMembership =
    memberships.find((membership) => membership.branchId === activeBranchId) ??
    memberships[0] ??
    null;

  if (!selectedMembership) {
    return { activeBranchId: null, activeBranchScope: null, errorKey: 'merchant_branch_access_invalid' };
  }

  return {
    activeBranchId: selectedMembership.branchId,
    activeBranchScope: {
      merchantId: selectedMembership.merchantId,
      branchId: selectedMembership.branchId,
      branchName: null,
      source: 'branch_membership',
      status: 'resolved',
    },
    errorKey: null,
  };
}

function parseUser(accessToken: string, idToken: string, preferredActiveBranchId: string | null): {
  profile: UserProfile | null;
  activeBranchScope: ActiveBranchScope | null;
  errorKey: string | null;
  invalidMembershipCount: number;
} {
  const accessClaims = decodeJwt(accessToken);
  const idClaims = decodeJwt(idToken);
  const profileClaims = idClaims.sub ? idClaims : accessClaims;

  if (!profileClaims.sub) {
    return {
      profile: null,
      activeBranchScope: null,
      errorKey: 'merchant_branch_access_invalid',
      invalidMembershipCount: 0,
    };
  }

  const { memberships, invalidCount } = parseBranchMemberships(accessClaims);
  const branchScope = buildBranchScope(memberships, preferredActiveBranchId);
  const merchantId =
    resolveMerchantId(accessClaims) ??
    resolveMerchantId(profileClaims) ??
    memberships[0]?.merchantId ??
    null;

  return {
    profile: {
      id: profileClaims.sub as string,
      merchantId,
      email: (profileClaims.email as string) ?? '',
      name: (profileClaims.name as string) ?? (profileClaims.preferred_username as string) ?? '',
      emailVerified: (profileClaims.email_verified as boolean) ?? false,
      branchMemberships: memberships,
      activeBranchId: branchScope.activeBranchId,
    },
    activeBranchScope: branchScope.activeBranchScope,
    errorKey: invalidCount > 0 && memberships.length === 0 ? 'merchant_branch_access_invalid' : branchScope.errorKey,
    invalidMembershipCount: invalidCount,
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
  branchMemberships: [
    {
      groupPath: '/merchants/merchant_dev-bypass-merchant/branch_branch_demo',
      merchantId: 'dev-bypass-merchant',
      branchId: 'branch_demo',
    },
  ],
  activeBranchId: 'branch_demo',
};

const BYPASS_BRANCH_SCOPE: ActiveBranchScope = {
  merchantId: 'dev-bypass-merchant',
  branchId: 'branch_demo',
  branchName: 'Demo Branch',
  source: 'branch_membership',
  status: 'resolved',
};

const defaultAuth: AuthState = {
  initialized: false,
  authenticated: false,
  token: null,
  user: null,
  activeBranchScope: null,
  branchScopeError: null,
  isBiometricAvailable: false,
  biometricEnrolled: false,
  retryBranchScope: async () => {},
  selectActiveBranch: async () => {},
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
  const [activeBranchScope, setActiveBranchScope] = useState<ActiveBranchScope | null>(isBypass ? BYPASS_BRANCH_SCOPE : null);
  const [branchScopeError, setBranchScopeError] = useState<string | null>(null);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [biometricEnrolled, setBiometricEnrolled] = useState(false);
  const initStarted = useRef(false);

  async function readActiveBranchId(): Promise<string | null> {
    try {
      return await storage.getItem(ACTIVE_BRANCH_KEY);
    } catch {
      return null;
    }
  }

  async function writeActiveBranchId(branchId: string | null): Promise<void> {
    try {
      if (branchId) await storage.setItem(ACTIVE_BRANCH_KEY, branchId);
      else await storage.deleteItem(ACTIVE_BRANCH_KEY);
    } catch {
      // non-fatal
    }
  }

  async function applySessionUser(accessToken: string, idToken: string, source: string): Promise<UserProfile | null> {
    const preferredActiveBranchId = await readActiveBranchId();
    observability.info('merchant_branch_scope_resolution_started', {
      source,
      preferredActiveBranchId: preferredActiveBranchId ?? null,
    });

    const parsed = parseUser(accessToken, idToken, preferredActiveBranchId);
    setUser(parsed.profile);
    setActiveBranchScope(parsed.activeBranchScope);
    setBranchScopeError(parsed.errorKey);

    if (parsed.profile?.activeBranchId) {
      await writeActiveBranchId(parsed.profile.activeBranchId);
    } else {
      await writeActiveBranchId(null);
    }

    if (parsed.profile && parsed.profile.branchMemberships.length > 0 && parsed.profile.activeBranchId) {
      observability.info('merchant_branch_scope_resolution_succeeded', {
        source,
        membershipCount: parsed.profile.branchMemberships.length,
        invalidMembershipCount: parsed.invalidMembershipCount,
        activeBranchId: parsed.profile.activeBranchId ?? null,
        merchantId: parsed.profile.merchantId ?? null,
      });
    } else {
      observability.warn('merchant_branch_scope_resolution_failed', {
        source,
        reason: parsed.errorKey ?? 'profile_parse_failed',
        membershipCount: parsed.profile?.branchMemberships.length ?? 0,
        invalidMembershipCount: parsed.invalidMembershipCount,
      });
    }

    return parsed.profile;
  }

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
            await applySessionUser(stored.accessToken, stored.idToken, 'stored_session');
            setAuthenticated(true);
            setInitialized(true);
            scheduleRefresh(stored);
            return;
          } else if (stored.refreshToken) {
            const renewed = await refreshAccessToken(stored.refreshToken);
            if (renewed) {
              await storage.setItem(SESSION_KEY, JSON.stringify(renewed));
              setToken(renewed.accessToken);
              await applySessionUser(renewed.accessToken, renewed.idToken, 'session_refresh');
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
            await applySessionUser(renewed.accessToken, renewed.idToken, 'scheduled_refresh');
            scheduleRefresh(renewed);
          } else {
            await storage.deleteItem(SESSION_KEY);
            await writeActiveBranchId(null);
            setAuthenticated(false);
            setToken(null);
            setUser(null);
            setActiveBranchScope(null);
            setBranchScopeError(null);
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
    await applySessionUser(d.access_token, d.id_token, 'login');
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
    await applySessionUser(renewed.accessToken, renewed.idToken, 'biometric_refresh');
    setAuthenticated(true);
    scheduleRefresh(renewed);
  };

  const logout = async (): Promise<void> => {
    await storage.deleteItem(SESSION_KEY);
    await writeActiveBranchId(null);
    setAuthenticated(false);
    setToken(null);
    setUser(null);
    setActiveBranchScope(null);
    setBranchScopeError(null);
  };

  const enrollBiometric = async (): Promise<void> => {
    await storage.setItem(BIOMETRIC_KEY, 'true');
    setBiometricEnrolled(true);
  };

  const retryBranchScope = async (): Promise<void> => {
    if (isBypass) {
      setBranchScopeError(null);
      setActiveBranchScope(BYPASS_BRANCH_SCOPE);
      return;
    }

    const raw = await storage.getItem(SESSION_KEY);
    if (!raw) {
      setBranchScopeError('merchant_branch_access_missing');
      setActiveBranchScope(null);
      return;
    }

    const stored = JSON.parse(raw) as StoredSession;
    await applySessionUser(stored.accessToken, stored.idToken, 'manual_retry');
  };

  const selectActiveBranch = async (branchId: string): Promise<void> => {
    if (!user) return;
    if (!user.branchMemberships.some((membership) => membership.branchId === branchId)) {
      setBranchScopeError('merchant_branch_access_denied');
      observability.warn('merchant_branch_scope_selection_failed', {
        branchId,
        reason: 'branch_not_authorized',
      });
      return;
    }

    await writeActiveBranchId(branchId);
    const nextProfile = {
      ...user,
      activeBranchId: branchId,
    };
    const nextScope = buildBranchScope(nextProfile.branchMemberships, branchId);
    setUser({
      ...nextProfile,
      activeBranchId: nextScope.activeBranchId,
    });
    setActiveBranchScope(nextScope.activeBranchScope);
    setBranchScopeError(nextScope.errorKey);
    observability.info('merchant_branch_scope_selection_succeeded', {
      branchId,
      merchantId: nextScope.activeBranchScope?.merchantId ?? null,
    });
  };

  return (
    <AuthContext.Provider value={{
      initialized, authenticated, token, user, activeBranchScope, branchScopeError,
      isBiometricAvailable, biometricEnrolled,
      retryBranchScope, selectActiveBranch,
      login, loginWithBiometric, logout, enrollBiometric,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
