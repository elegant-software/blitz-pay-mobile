import { storage } from '../storage';
import { config } from '../config';
import { observability } from '../observability';
import { notifySessionExpired } from '../auth';

const SESSION_KEY = 'blitzpay_session';

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresAt: number;
}

async function readSession(): Promise<StoredSession | null> {
  try {
    const raw = await storage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

async function writeSession(session: StoredSession): Promise<void> {
  try {
    await storage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // non-fatal
  }
}

async function refresh(refreshToken: string): Promise<StoredSession | null> {
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
    const d = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      id_token: string;
      expires_in: number;
    };
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

function joinUrl(base: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const trimmedBase = base.replace(/\/+$/, '');
  const trimmedPath = path.startsWith('/') ? path : `/${path}`;
  return `${trimmedBase}${trimmedPath}`;
}

export interface AuthedFetchInit extends RequestInit {
  baseUrl?: string;
}

export async function authedFetch(path: string, init: AuthedFetchInit = {}): Promise<Response> {
  const { baseUrl = config.apiUrl, headers, ...rest } = init;
  const url = joinUrl(baseUrl, path);
  const shouldDebugOrders = path.startsWith('/v1/orders');
  const session = await readSession();

  const doFetch = async (token: string | null): Promise<Response> => {
    const mergedHeaders = new Headers(headers as HeadersInit | undefined);
    if (token) mergedHeaders.set('Authorization', `Bearer ${token}`);
    if (!mergedHeaders.has('Accept')) mergedHeaders.set('Accept', 'application/json');
    if (shouldDebugOrders) {
      const authorizationHeader = mergedHeaders.get('Authorization');
      observability.info('authed_fetch_debug', {
        path,
        url,
        method: (rest.method ?? 'GET').toUpperCase(),
        hasSession: Boolean(session),
        hasAccessToken: Boolean(session?.accessToken),
        hasRefreshToken: Boolean(session?.refreshToken),
        authAttached: Boolean(authorizationHeader),
        authorizationScheme: authorizationHeader?.split(' ')[0] ?? null,
        accept: mergedHeaders.get('Accept') ?? null,
        hasContentType: mergedHeaders.has('Content-Type'),
      });
    }
    return fetch(url, { ...rest, headers: mergedHeaders });
  };

  let response = await doFetch(session?.accessToken ?? null);

  if (response.status === 401 && session?.refreshToken) {
    const renewed = await refresh(session.refreshToken);
    if (renewed) {
      await writeSession(renewed);
      response = await doFetch(renewed.accessToken);
    } else {
      observability.warn('auth_session_expired', {
        path,
        url,
        method: (rest.method ?? 'GET').toUpperCase(),
      });
      notifySessionExpired();
    }
  }

  if (response.status === 401) {
    observability.warn('authed_fetch_unauthorized', {
      path,
      url,
      method: (rest.method ?? 'GET').toUpperCase(),
      hadRefreshToken: Boolean(session?.refreshToken),
    });
  }

  return response;
}
