import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { authedFetch } from '../api/authedFetch';
import { storage } from '../storage';
import { observability } from '../observability';
import { PUSH_TOKEN_STORAGE_KEY } from '../payments/constants';
import { ensurePaymentsChannel } from './channels';

let tokenInFlight: Promise<string | null> | null = null;

function getProjectId(): string | undefined {
  const easProjectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;
  return typeof easProjectId === 'string' && easProjectId.length > 0 ? easProjectId : undefined;
}

function backendPlatform(): 'IOS' | 'ANDROID' {
  return Platform.OS === 'ios' ? 'IOS' : 'ANDROID';
}

async function requestPermissions(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }
  if (!settings.canAskAgain) return false;
  const req = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
      allowProvisional: true,
    },
  });
  return (
    req.granted || req.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

async function acquireExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    observability.info('push_registration_skipped_simulator', {
      platform: Platform.OS,
    });
    return null;
  }

  const granted = await requestPermissions();
  if (!granted) {
    observability.info('push_registration_permission_denied', {});
    return null;
  }

  await ensurePaymentsChannel();

  try {
    const projectId = getProjectId();
    const result = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = result.data;
    try {
      await storage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
    } catch {
      // non-fatal
    }
    return token;
  } catch (err) {
    observability.warn('push_token_fetch_failed', {
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function getExpoPushToken(): Promise<string | null> {
  if (tokenInFlight) return tokenInFlight;
  tokenInFlight = acquireExpoPushToken().finally(() => {
    tokenInFlight = null;
  });
  return tokenInFlight;
}

export async function registerDeviceForPayment(orderId: string): Promise<boolean> {
  observability.info('device_registration_started', {
    orderId,
    platform: Platform.OS,
    isPhysicalDevice: Device.isDevice,
  });

  const token = await getExpoPushToken();
  if (!token) {
    observability.warn('device_registration_skipped_no_token', {
      orderId,
      platform: Platform.OS,
      isPhysicalDevice: Device.isDevice,
    });
    return false;
  }

  const body = JSON.stringify({
    orderId,
    expoPushToken: token,
    platform: backendPlatform(),
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await authedFetch('/v1/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (res.ok) {
        observability.info('device_registered_for_payment', {
          orderId,
          status: res.status,
          attempt,
        });
        return true;
      }
      const bodySnippet = await res
        .text()
        .then((text) => text.slice(0, 1000))
        .catch(() => '');
      if (res.status === 404) {
        observability.warn('device_registration_payment_not_found', {
          orderId,
          body: bodySnippet,
        });
        return false;
      }
      if (res.status === 400 || res.status === 401) {
        observability.error('device_registration_rejected', {
          orderId,
          status: res.status,
          attempt,
          body: bodySnippet,
        });
        return false;
      }
      observability.warn('device_registration_non_ok', {
        orderId,
        status: res.status,
        attempt,
        body: bodySnippet,
      });
    } catch (err) {
      observability.warn('device_registration_network_error', {
        orderId,
        attempt,
        message: err instanceof Error ? err.message : String(err),
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
  observability.error('device_registration_exhausted', {
    orderId,
  });
  return false;
}

export async function unregisterDevice(): Promise<void> {
  let token: string | null = null;
  try {
    token = await storage.getItem(PUSH_TOKEN_STORAGE_KEY);
  } catch {
    token = null;
  }
  if (!token) return;
  try {
    await authedFetch(`/v1/devices/${encodeURIComponent(token)}`, { method: 'DELETE' });
  } catch {
    // non-fatal
  }
  try {
    await storage.deleteItem(PUSH_TOKEN_STORAGE_KEY);
  } catch {
    // non-fatal
  }
}
