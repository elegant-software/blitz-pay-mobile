import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import {
  fetchCurrentlyHappeningAppearances,
  fetchGeofenceRegions,
  fetchNearbyMerchants,
  readNearbyMerchantRefreshMarker,
} from '../services/nearbyMerchantService';
import type { ActiveAppearance, NearbyMerchant } from '../types/nearbyMerchant';

type NearbyMerchantsState = {
  merchants: NearbyMerchant[];
  appearances: ActiveAppearance[];
  nearbyLoading: boolean;
  appearancesLoading: boolean;
  nearbyErrorKey: string | null;
  appearancesErrorKey: string | null;
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
    appearances: [],
    nearbyLoading: true,
    appearancesLoading: true,
    nearbyErrorKey: null,
    appearancesErrorKey: null,
    locationLabel: '…',
    permissionDenied: false,
    refreshedAt: null,
  });

  const loadPositionContext = useCallback(async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      return { permissionDenied: true as const };
    }

    const coords = await getPosition();
    const query = {
      latitude: coords.latitude,
      longitude: coords.longitude,
    };

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
    return {
      permissionDenied: false as const,
      query,
      locationLabel,
      refreshedAt: refreshMarker ?? String(Date.now()),
    };
  }, []);

  const loadMerchants = useCallback(async (reason: 'initial' | 'focus' | 'retry' = 'initial') => {
    setState((current) => ({
      ...current,
      nearbyLoading: true,
      appearancesLoading: true,
      nearbyErrorKey: null,
      appearancesErrorKey: null,
    }));

    try {
      const position = await loadPositionContext();
      if (position.permissionDenied) {
        setState((current) => ({
          ...current,
          nearbyLoading: false,
          appearancesLoading: false,
          merchants: [],
          appearances: [],
          permissionDenied: true,
          nearbyErrorKey: 'location_permission_required',
          appearancesErrorKey: 'location_permission_required',
        }));
        return;
      }

      const [merchantsResult, appearancesResult] = await Promise.allSettled([
        fetchNearbyMerchants(position.query),
        fetchCurrentlyHappeningAppearances(position.query),
        fetchGeofenceRegions(position.query),
      ]);

      setState({
        merchants: merchantsResult.status === 'fulfilled' ? merchantsResult.value : [],
        appearances: appearancesResult.status === 'fulfilled' ? appearancesResult.value : [],
        nearbyLoading: false,
        appearancesLoading: false,
        nearbyErrorKey: merchantsResult.status === 'fulfilled'
          ? null
          : reason === 'retry'
            ? 'nearby_merchants_retry_failed'
            : 'nearby_merchants_load_failed',
        appearancesErrorKey: appearancesResult.status === 'fulfilled'
          ? null
          : reason === 'retry'
            ? 'happening_now_retry_failed'
            : 'happening_now_load_failed',
        permissionDenied: false,
        locationLabel: position.locationLabel,
        refreshedAt: position.refreshedAt,
      });
    } catch {
      setState((current) => ({
        ...current,
        nearbyLoading: false,
        appearancesLoading: false,
        merchants: [],
        appearances: [],
        nearbyErrorKey: reason === 'retry' ? 'nearby_merchants_retry_failed' : 'nearby_merchants_load_failed',
        appearancesErrorKey: reason === 'retry' ? 'happening_now_retry_failed' : 'happening_now_load_failed',
      }));
    }
  }, [loadPositionContext]);

  const refreshAppearances = useCallback(async () => {
    setState((current) => ({
      ...current,
      appearancesLoading: true,
      appearancesErrorKey: null,
    }));

    try {
      const position = await loadPositionContext();
      if (position.permissionDenied) {
        setState((current) => ({
          ...current,
          appearancesLoading: false,
          appearances: [],
          permissionDenied: true,
          appearancesErrorKey: 'location_permission_required',
        }));
        return;
      }

      const appearances = await fetchCurrentlyHappeningAppearances(position.query);
      setState((current) => ({
        ...current,
        appearances,
        appearancesLoading: false,
        appearancesErrorKey: null,
        permissionDenied: false,
        locationLabel: position.locationLabel,
        refreshedAt: position.refreshedAt,
      }));
    } catch {
      setState((current) => ({
        ...current,
        appearancesLoading: false,
        appearances: [],
        appearancesErrorKey: 'happening_now_retry_failed',
      }));
    }
  }, [loadPositionContext]);

  const refreshNearby = useCallback(async () => {
    setState((current) => ({
      ...current,
      nearbyLoading: true,
      nearbyErrorKey: null,
    }));

    try {
      const position = await loadPositionContext();
      if (position.permissionDenied) {
        setState((current) => ({
          ...current,
          nearbyLoading: false,
          merchants: [],
          permissionDenied: true,
          nearbyErrorKey: 'location_permission_required',
        }));
        return;
      }

      const [merchants] = await Promise.all([
        fetchNearbyMerchants(position.query),
        fetchGeofenceRegions(position.query),
      ]);
      setState((current) => ({
        ...current,
        merchants,
        nearbyLoading: false,
        nearbyErrorKey: null,
        permissionDenied: false,
        locationLabel: position.locationLabel,
        refreshedAt: position.refreshedAt,
      }));
    } catch {
      setState((current) => ({
        ...current,
        nearbyLoading: false,
        merchants: [],
        nearbyErrorKey: 'nearby_merchants_retry_failed',
      }));
    }
  }, [loadPositionContext]);

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

  const appearances = useMemo(
    () =>
      state.appearances.map((appearance) => ({
        ...appearance,
        distanceLabel:
          appearance.distanceMeters != null && Number.isFinite(appearance.distanceMeters)
            ? formatDistance(appearance.distanceMeters)
            : null,
      })),
    [state.appearances],
  );

  return {
    merchants,
    appearances,
    loading: state.nearbyLoading,
    appearanceLoading: state.appearancesLoading,
    errorKey: state.nearbyErrorKey,
    appearanceErrorKey: state.appearancesErrorKey,
    locationLabel: state.locationLabel,
    permissionDenied: state.permissionDenied,
    refresh: () => loadMerchants('retry'),
    refreshAppearances,
    refreshNearby,
  };
}
