import * as Location from 'expo-location';
import { storage } from '../lib/storage';
import { config } from '../lib/config';
import { MERCHANT_REGIONS } from '../lib/geofenceRegions';
import { GEOFENCE_TASK, GEOFENCE_POLL_TASK } from '../lib/geofenceConstants';
import type { ProximityReportPayload, ProximityReportResponse } from '../types/geofence';

const SESSION_KEY = 'blitzpay_merchant_session';
const COOLDOWN_KEY = 'geofence_cooldown';
const COOLDOWN_MS = 30 * 1000; // 30 seconds

interface StoredCooldown {
  [key: string]: number; // key = `regionId:event`, value = timestamp ms
}

async function getStoredToken(): Promise<string | null> {
  const raw = await storage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as { accessToken?: string };
    return session.accessToken ?? null;
  } catch {
    return null;
  }
}

export async function reportProximity(
  payload: ProximityReportPayload,
): Promise<ProximityReportResponse> {
  const apiUrl = config.apiUrl;
  if (!apiUrl) return { recorded: false, action: 'none' };

  const token = await getStoredToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const resp = await fetch(`${apiUrl}/v1/proximity`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (resp.status === 401) {
    console.warn('[geofence] proximity API 401 — token may be expired');
    return { recorded: false, action: 'none' };
  }
  if (resp.status === 429) {
    const body = await resp.json() as { retryAfterSeconds?: number };
    console.warn(`[geofence] proximity API 429 — retry after ${body.retryAfterSeconds ?? '?'}s`);
    return { recorded: false, action: 'none' };
  }
  if (!resp.ok) throw new Error(`proximity_api_error: ${resp.status}`);

  return resp.json() as Promise<ProximityReportResponse>;
}

export async function reportProximityIfNotCooledDown(params: {
  regionId: string;
  merchantName: string;
  latitude: number;
  longitude: number;
}): Promise<ProximityReportResponse | null> {
  const { regionId, merchantName, latitude, longitude } = params;
  const cooldownKey = `${regionId}:enter`;
  const now = Date.now();

  const raw = await storage.getItem(COOLDOWN_KEY);
  const cooldown: StoredCooldown = raw ? (JSON.parse(raw) as StoredCooldown) : {};

  if (cooldown[cooldownKey] && now - cooldown[cooldownKey] < COOLDOWN_MS) {
    console.log(`[geofence] skipping ${regionId} — within cooldown window`);
    return null;
  }

  const payload: ProximityReportPayload = {
    regionId,
    event: 'enter',
    location: { latitude, longitude },
    timestamp: new Date().toISOString(),
  };

  let response: ProximityReportResponse;
  try {
    response = await reportProximity(payload);
    console.log(`[geofence] reported ${regionId} → action=${response.action} merchant=${merchantName}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[geofence] reportProximity failed: ${msg}`);
    return null;
  }

  cooldown[cooldownKey] = now;
  await storage.setItem(COOLDOWN_KEY, JSON.stringify(cooldown));

  return response;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function startGeofencing(): Promise<void> {
  const { status: fg } = await Location.requestForegroundPermissionsAsync();
  if (fg !== 'granted') throw new Error('foreground_permission_denied');

  const { status: bg } = await Location.requestBackgroundPermissionsAsync();
  if (bg !== 'granted') throw new Error('background_permission_denied');

  let sortedRegions = MERCHANT_REGIONS.filter((r) => r.enabled);
  try {
    const pos = await Location.getLastKnownPositionAsync({});
    if (pos) {
      sortedRegions = sortedRegions.sort(
        (a, b) =>
          haversineMeters(pos.coords.latitude, pos.coords.longitude, a.latitude, a.longitude) -
          haversineMeters(pos.coords.latitude, pos.coords.longitude, b.latitude, b.longitude),
      );
    }
  } catch {
    // Coarse location unavailable
  }

  const regions = sortedRegions.slice(0, 20).map((r) => ({
    identifier: r.merchantName,
    latitude: r.latitude,
    longitude: r.longitude,
    radius: r.radius,
    notifyOnEnter: r.notifyOnEnter,
    notifyOnExit: r.notifyOnExit,
  }));

  await Location.startGeofencingAsync(GEOFENCE_TASK, regions);

  const started = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
  if (!started) {
    console.warn('[geofence] startGeofencingAsync failed — falling back to polling');
    await startPolling();
  }
}

export async function stopGeofencing(): Promise<void> {
  if (await Location.hasStartedGeofencingAsync(GEOFENCE_TASK)) {
    await Location.stopGeofencingAsync(GEOFENCE_TASK);
  }
  await stopPolling();
}

export async function startPolling(): Promise<void> {
  await Location.startLocationUpdatesAsync(GEOFENCE_POLL_TASK, {
    timeInterval: 30_000,
    distanceInterval: 0,           // fire on time alone — device may be stationary
    accuracy: Location.Accuracy.Low, // network/cell-tower; works without GMS (e.g. Fire OS)
    foregroundService: {
      notificationTitle: 'BlitzPay Merchant',
      notificationBody: 'Monitoring branch proximity…',
      notificationColor: '#00C2FF',
    },
  });
}

export async function stopPolling(): Promise<void> {
  const TaskManager = await import('expo-task-manager');
  if (!(await TaskManager.isAvailableAsync())) {
    return;
  }
  const started = await Location.hasStartedLocationUpdatesAsync(GEOFENCE_POLL_TASK);
  if (!started) {
    return;
  }
  try {
    await Location.stopLocationUpdatesAsync(GEOFENCE_POLL_TASK);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // OS killed the task between our check and the stop call — nothing to do.
    if (message.includes('TaskNotFoundException') || message.includes('not found')) return;
    throw err;
  }
}
