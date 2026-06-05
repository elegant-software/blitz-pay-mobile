import { Platform } from 'react-native';
import { getExpoPushToken } from './pushRegistration';
import { registerShopperDevice, unregisterShopperDevice } from '../../features/appointments/services/appointmentService';
import { storage } from '../storage';
import { observability } from '../observability';

const SHOPPER_TOKEN_REGISTERED_KEY = 'blitzpay_shopper_device_registered';

/**
 * Register the device's Expo push token with the shopper device endpoint.
 * Idempotent — safe to call on every app launch. Skips if already registered
 * with the same token.
 */
export async function registerShopperPushToken(): Promise<void> {
  try {
    const token = await getExpoPushToken();
    if (!token) return;

    const lastRegistered = await storage.getItem(SHOPPER_TOKEN_REGISTERED_KEY);
    if (lastRegistered === token) {
      // Already registered with this exact token
      return;
    }

    await registerShopperDevice({
      expoPushToken: token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });

    await storage.setItem(SHOPPER_TOKEN_REGISTERED_KEY, token);
    observability.info('shopper_device_registered', { platform: Platform.OS });
  } catch (err) {
    // Non-fatal — appointment push notifications may not work but the app continues
    observability.warn('shopper_device_registration_failed', {
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Unregister the push token when the shopper logs out.
 */
export async function unregisterShopperPushToken(): Promise<void> {
  try {
    const token = await storage.getItem(SHOPPER_TOKEN_REGISTERED_KEY);
    if (!token) return;
    await unregisterShopperDevice(token);
    await storage.deleteItem(SHOPPER_TOKEN_REGISTERED_KEY);
    observability.info('shopper_device_unregistered', {});
  } catch {
    // Non-fatal
  }
}
