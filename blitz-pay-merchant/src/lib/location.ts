import * as Location from 'expo-location';
import Geolocation from '@react-native-community/geolocation';
import { Platform } from 'react-native';
import { MerchantProductError } from './merchantProducts';

// Fire OS ships without Google Mobile Services. expo-location's FusedLocationProviderClient
// is GMS-only, so getLastKnownPositionAsync / getCurrentPositionAsync always return null
// on Fire OS. @react-native-community/geolocation with locationProvider:'android' uses
// Android's native LocationManager directly — no GMS required.

const isFireOS =
  Platform.OS === 'android' &&
  (Platform.constants as { Manufacturer?: string }).Manufacturer?.toLowerCase() === 'amazon';

// Configure native geolocation to use Android's LocationManager (not Play Services)
// on Fire OS. Safe to call at module load time.
if (isFireOS) {
  Geolocation.setRNConfiguration({ skipPermissionRequests: false, locationProvider: 'android' });
}

// Testing override — set in blitz-pay-merchant/.env to bypass location resolution on any device:
//   EXPO_PUBLIC_MOCK_LAT=48.8566
//   EXPO_PUBLIC_MOCK_LNG=2.3522
const MOCK_LAT = process.env.EXPO_PUBLIC_MOCK_LAT;
const MOCK_LNG = process.env.EXPO_PUBLIC_MOCK_LNG;

function getCurrentPositionNative(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => reject(new Error(err.message)),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 30000 },
    );
  });
}

export async function resolveCurrentCoordinates(): Promise<{ latitude: number; longitude: number }> {
  // Mock override — works on any device when env vars are set (useful for testing).
  if (MOCK_LAT && MOCK_LNG) {
    const latitude = parseFloat(MOCK_LAT);
    const longitude = parseFloat(MOCK_LNG);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude };
    }
  }

  // Fire OS: use native Android LocationManager via @react-native-community/geolocation.
  if (isFireOS) {
    try {
      return await getCurrentPositionNative();
    } catch (err) {
      throw new MerchantProductError('merchant_location_unavailable', 'location_unavailable');
    }
  }

  // GMS devices (standard Android + iOS): use expo-location.
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== Location.PermissionStatus.GRANTED) {
    throw new MerchantProductError('merchant_location_permission_required', `location_permission_${status}`);
  }

  const lastKnown = await Location.getLastKnownPositionAsync({}).catch(() => null);
  if (lastKnown) {
    return { latitude: lastKnown.coords.latitude, longitude: lastKnown.coords.longitude };
  }

  const current = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Low,
  }).catch(() => null);
  if (current) {
    return { latitude: current.coords.latitude, longitude: current.coords.longitude };
  }

  throw new MerchantProductError('merchant_location_unavailable', 'location_unavailable');
}
