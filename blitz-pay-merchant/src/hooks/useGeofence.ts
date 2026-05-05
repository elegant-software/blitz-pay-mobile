import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Linking } from 'react-native';
import { storage } from '../lib/storage';
import { startGeofencing, stopGeofencing, startPolling, stopPolling } from '../services/geofence';
import { GEOFENCE_POLL_TASK } from '../lib/geofenceConstants';
import type { GeofenceConfig } from '../types/geofence';

const CONFIG_KEY = 'geofence_config';

const DEFAULT_CONFIG: GeofenceConfig = {
  geofencingEnabled: false,
  pollingEnabled: false,
  pollingIntervalMs: 60000,
  backgroundPermissionGranted: false,
};

export function useGeofence() {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [config, setConfig] = useState<GeofenceConfig>(DEFAULT_CONFIG);
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const raw = await storage.getItem(CONFIG_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as GeofenceConfig;
        setConfig(saved);
        if (saved.geofencingEnabled) {
          try {
            await startGeofencing();
            setIsMonitoring(true);
          } catch {
            const updated = { ...saved, geofencingEnabled: false, pollingEnabled: false };
            await storage.setItem(CONFIG_KEY, JSON.stringify(updated));
            setConfig(updated);
          }
        }
        if (saved.pollingEnabled) {
          try {
            await startPolling();
            setIsPolling(true);
          } catch {
            const updated = { ...saved, pollingEnabled: false };
            await storage.setItem(CONFIG_KEY, JSON.stringify(updated));
            setConfig(updated);
          }
        }
      }
      // Sync isPolling with actual task state in case of stale config
      if (await TaskManager.isAvailableAsync()) {
        const polling = await TaskManager.isTaskRegisteredAsync(GEOFENCE_POLL_TASK);
        setIsPolling(polling);
      }
    })();
  }, []);

  const enable = useCallback(async (): Promise<'ok' | 'background_denied' | 'foreground_denied' | 'error' | 'not_available'> => {
    setError(null);
    if (!(await TaskManager.isAvailableAsync())) {
      setError('TaskManager not available');
      return 'not_available';
    }
    try {
      await startGeofencing();
      // On Fire OS, startGeofencing falls back to polling — sync state from actual task.
      const polling = await TaskManager.isTaskRegisteredAsync(GEOFENCE_POLL_TASK);
      const updated: GeofenceConfig = {
        ...config,
        geofencingEnabled: true,
        pollingEnabled: polling,
        backgroundPermissionGranted: !polling,
      };
      await storage.setItem(CONFIG_KEY, JSON.stringify(updated));
      setConfig(updated);
      setIsMonitoring(true);
      setIsPolling(polling);
      setPermissionStatus(Location.PermissionStatus.GRANTED);
      return 'ok';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      if (msg === 'background_permission_denied') {
        setPermissionStatus(Location.PermissionStatus.DENIED);
        return 'background_denied';
      }
      if (msg === 'foreground_permission_denied') {
        return 'foreground_denied';
      }
      return 'error';
    }
  }, [config]);

  // Returns true if the user needs to go to Settings to grant "Always" location
  const needsSettingsForBackground = permissionStatus === Location.PermissionStatus.DENIED;

  const openSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  const disable = useCallback(async () => {
    try { await stopGeofencing(); } catch { /* best-effort stop */ }
    const updated: GeofenceConfig = { ...config, geofencingEnabled: false, pollingEnabled: false };
    await storage.setItem(CONFIG_KEY, JSON.stringify(updated));
    setConfig(updated);
    setIsMonitoring(false);
    setIsPolling(false);
  }, [config]);

  const enablePolling = useCallback(async (): Promise<'ok' | 'not_available' | 'error'> => {
    if (!(await TaskManager.isAvailableAsync())) {
      setError('TaskManager not available');
      return 'not_available';
    }
    // Foreground service polling only needs ACCESS_FINE_LOCATION — no "Always" required.
    const { status: fg } = await Location.getForegroundPermissionsAsync();
    if (fg !== 'granted') {
      setError('foreground_permission_denied');
      return 'error';
    }
    try {
      await startPolling();
      const updated: GeofenceConfig = { ...config, pollingEnabled: true };
      await storage.setItem(CONFIG_KEY, JSON.stringify(updated));
      setConfig(updated);
      setIsPolling(true);
      return 'ok';
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      return 'error';
    }
  }, [config]);

  const disablePolling = useCallback(async () => {
    try { await stopPolling(); } catch { /* best-effort stop */ }
    const updated: GeofenceConfig = { ...config, pollingEnabled: false };
    await storage.setItem(CONFIG_KEY, JSON.stringify(updated));
    setConfig(updated);
    setIsPolling(false);
  }, [config]);

  return { isMonitoring, isPolling, config, enable, disable, enablePolling, disablePolling, permissionStatus, error, needsSettingsForBackground, openSettings };
}
