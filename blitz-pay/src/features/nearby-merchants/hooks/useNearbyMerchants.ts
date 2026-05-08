import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import {
  fetchGeofenceRegions,
  fetchNearbyMerchants,
  readNearbyMerchantRefreshMarker,
} from '../services/nearbyMerchantService';
import type { NearbyMerchant } from '../types/nearbyMerchant';

type NearbyMerchantsState = {
  merchants: NearbyMerchant[];
  loading: boolean;
  errorKey: string | null;
  locationLabel: string;
  permissionDenied: boolean;
  refreshedAt: string | null;
};

async function getPosition(): Promise<Location.LocationObjectCoords> {
  const current = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return current.coords;
}

export function formatDistance(distanceMeters: number): string {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`;
  }
  return `${(distanceMeters / 1000).toFixed(1)} km`;
}

export function useNearbyMerchants() {
  const [state, setState] = useState<NearbyMerchantsState>({
    merchants: [],
    loading: true,
    errorKey: null,
    locationLabel: '…',
    permissionDenied: false,
    refreshedAt: null,
  });

  const loadMerchants = useCallback(async (reason: 'initial' | 'focus' | 'retry' = 'initial') => {
    setState((current) => ({ ...current, loading: true, errorKey: null }));

    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      setState((current) => ({
        ...current,
        loading: false,
        merchants: [],
        permissionDenied: true,
        errorKey: 'location_permission_required',
      }));
      return;
    }

    try {
      const coords = await getPosition();
      const merchants = await fetchNearbyMerchants({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      void fetchGeofenceRegions({
        latitude: coords.latitude,
        longitude: coords.longitude,
      }).catch(() => undefined);

      let locationLabel = `${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)}`;
      try {
        const [place] = await Location.reverseGeocodeAsync({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        if (place) {
          const parts = [
            place.district,
            place.city ?? place.subregion ?? place.region,
            place.country,
          ].filter(Boolean);
          if (parts.length > 0) locationLabel = parts.join(', ');
        }
      } catch {
        // keep raw coords as fallback
      }

      const refreshMarker = await readNearbyMerchantRefreshMarker();
      setState({
        merchants,
        loading: false,
        errorKey: null,
        permissionDenied: false,
        locationLabel,
        refreshedAt: refreshMarker ?? String(Date.now()),
      });
    } catch {
      setState((current) => ({
        ...current,
        loading: false,
        merchants: [],
        errorKey: reason === 'retry' ? 'nearby_merchants_retry_failed' : 'nearby_merchants_load_failed',
      }));
    }
  }, []);

  useEffect(() => {
    void loadMerchants('initial');
  }, [loadMerchants]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void readNearbyMerchantRefreshMarker().then((marker) => {
        if (!active) return;
        if (marker && marker !== state.refreshedAt) {
          void loadMerchants('focus');
        }
      });
      return () => {
        active = false;
      };
    }, [loadMerchants, state.refreshedAt]),
  );

  const merchants = useMemo(
    () =>
      state.merchants.map((merchant) => ({
        ...merchant,
        distanceLabel: formatDistance(merchant.distanceMeters),
      })),
    [state.merchants],
  );

  return {
    merchants,
    loading: state.loading,
    errorKey: state.errorKey,
    locationLabel: state.locationLabel,
    permissionDenied: state.permissionDenied,
    refresh: () => loadMerchants('retry'),
  };
}
