import { storage } from './storage';
import { config } from './config';

const SESSION_KEY = 'blitzpay_merchant_session';

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresAt: number;
}

function joinUrl(base: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const trimmedBase = base.replace(/\/+$/, '');
  const trimmedPath = path.startsWith('/') ? path : `/${path}`;
  return `${trimmedBase}${trimmedPath}`;
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
    const d = await res.json() as {
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

async function writeSession(session: StoredSession): Promise<void> {
  try {
    await storage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // non-fatal
  }
}

export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = joinUrl(config.apiUrl, path);

  const execute = async (accessToken: string | null): Promise<Response> => {
    const headers = new Headers(init.headers);
    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }
    return fetch(url, { ...init, headers });
  };

  const session = await readSession();
  let response = await execute(session?.accessToken ?? null);

  if (response.status === 401 && session?.refreshToken) {
    const renewed = await refreshAccessToken(session.refreshToken);
    if (renewed) {
      await writeSession(renewed);
      response = await execute(renewed.accessToken);
    }
  }

  return response;
}
