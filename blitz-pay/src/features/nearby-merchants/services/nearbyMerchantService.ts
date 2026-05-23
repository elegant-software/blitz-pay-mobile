import { storage } from '../../../lib/storage';
import { fetchMerchantCommerceJson } from '../../../lib/api/merchantCommerce';
import { observability } from '../../../lib/observability';
import type {
  ActiveAppearance,
  GeofenceRegion,
  NearbyMerchant,
  NearbyMerchantQuery,
} from '../types/nearbyMerchant';

const REFRESH_MARKER_KEY = 'nearby_merchants_refresh_at';
const HAPPENING_NOW_RADIUS_METERS = 10_000;

type NearbyMerchantResponse = {
  merchants?: Array<{
    merchantId?: string;
    legalBusinessName?: string;
    latitude?: number;
    longitude?: number;
    distanceMeters?: number;
    geofenceRadiusMeters?: number;
    googlePlaceId?: string;
    activeBranches?: Array<{
      branchId?: string;
      name?: string;
      distanceMeters?: number;
    }>;
  }>;
};

type MerchantDetailsResponse = {
  logoUrl?: string;
};

type NearbyMerchantEntry = NonNullable<NearbyMerchantResponse['merchants']>[number];

type GeofenceRegionsResponse = {
  regions?: Array<{
    regionId?: string;
    displayName?: string;
    latitude?: number;
    longitude?: number;
    radiusMeters?: number;
    distanceMeters?: number;
  }>;
};

type CurrentlyHappeningResponse = {
  appearances?: Array<{
    appearanceId?: string;
    merchantId?: string;
    merchantName?: string;
    branchId?: string;
    branchName?: string;
    distanceMeters?: number;
    startTime?: string;
    endTime?: string;
  }>;
};

function ensureNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function mapNearbyMerchant(value: NearbyMerchantEntry): NearbyMerchant | null {
  if (!value?.merchantId || !value.legalBusinessName) return null;
  const nearestBranch = (value.activeBranches ?? [])
    .filter((branch) => branch?.branchId && branch.name)
    .sort((a, b) => ensureNumber(a.distanceMeters, Number.POSITIVE_INFINITY) - ensureNumber(b.distanceMeters, Number.POSITIVE_INFINITY))[0];

  return {
    merchantId: value.merchantId,
    merchantName: value.legalBusinessName,
    displayName: nearestBranch?.name ?? value.legalBusinessName,
    branchId: nearestBranch?.branchId,
    latitude: ensureNumber(value.latitude),
    longitude: ensureNumber(value.longitude),
    distanceMeters: ensureNumber(value.distanceMeters),
    geofenceRadiusMeters: ensureNumber(value.geofenceRadiusMeters),
    googlePlaceId: value.googlePlaceId,
  };
}

function mapActiveAppearance(
  value: NonNullable<CurrentlyHappeningResponse['appearances']>[number],
): ActiveAppearance | null {
  if (
    !value?.appearanceId
    || !value.merchantId
    || !value.merchantName
    || !value.branchId
    || !value.branchName
    || !value.startTime
    || !value.endTime
  ) {
    return null;
  }

  return {
    appearanceId: value.appearanceId,
    merchantId: value.merchantId,
    merchantName: value.merchantName,
    branchId: value.branchId,
    branchName: value.branchName,
    distanceMeters: ensureNumber(value.distanceMeters, Number.NaN),
    startTime: value.startTime,
    endTime: value.endTime,
  };
}

async function fetchMerchantLogoUrl(merchantId: string): Promise<string | undefined> {
  try {
    const details = await fetchMerchantCommerceJson<MerchantDetailsResponse>(
      `/merchants/${merchantId}`,
    );
    return details.logoUrl ?? undefined;
  } catch {
    return undefined;
  }
}

export async function fetchNearbyMerchants(
  query: NearbyMerchantQuery,
): Promise<NearbyMerchant[]> {
  observability.info('nearby_merchants_requested', {
    latitude: query.latitude,
    longitude: query.longitude,
    radiusMeters: query.radiusMeters ?? null,
  });

  const search = new URLSearchParams({
    lat: String(query.latitude),
    lng: String(query.longitude),
  });
  if (query.radiusMeters != null) {
    search.set('radiusMeters', String(query.radiusMeters));
  }
  try {
    const response = await fetchMerchantCommerceJson<NearbyMerchantResponse>(
      `/merchants/nearby?${search.toString()}`,
    );
    const merchants = (response.merchants ?? [])
      .map(mapNearbyMerchant)
      .filter((merchant): merchant is NearbyMerchant => merchant != null)
      .sort((a, b) => a.distanceMeters - b.distanceMeters);

    const logos = await Promise.allSettled(
      merchants.map((m) => fetchMerchantLogoUrl(m.merchantId)),
    );

    const resolved = merchants.map((merchant, i) => ({
      ...merchant,
      logoUrl: logos[i]?.status === 'fulfilled' ? logos[i].value : undefined,
    }));

    observability.info('nearby_merchants_loaded', {
      latitude: query.latitude,
      longitude: query.longitude,
      radiusMeters: query.radiusMeters ?? null,
      merchantCount: resolved.length,
    });

    return resolved;
  } catch (error) {
    observability.error(
      'nearby_merchants_failed',
      {
        latitude: query.latitude,
        longitude: query.longitude,
        radiusMeters: query.radiusMeters ?? null,
        reason: error instanceof Error ? error.message : 'unknown_error',
      },
      error instanceof Error ? error : undefined,
    );
    throw error;
  }
}

export async function fetchCurrentlyHappeningAppearances(
  query: NearbyMerchantQuery,
): Promise<ActiveAppearance[]> {
  observability.info('active_appearances_requested', {
    latitude: query.latitude,
    longitude: query.longitude,
    radiusMeters: HAPPENING_NOW_RADIUS_METERS,
  });

  const search = new URLSearchParams({
    latitude: String(query.latitude),
    longitude: String(query.longitude),
    radiusMeters: String(HAPPENING_NOW_RADIUS_METERS),
  });

  try {
    const response = await fetchMerchantCommerceJson<CurrentlyHappeningResponse>(
      `/appearances/currently-happening?${search.toString()}`,
    );
    const appearances = (response.appearances ?? [])
      .map(mapActiveAppearance)
      .filter((appearance): appearance is ActiveAppearance => appearance != null)
      .sort((a, b) => {
        const leftDistance = Number.isFinite(a.distanceMeters) ? a.distanceMeters! : Number.POSITIVE_INFINITY;
        const rightDistance = Number.isFinite(b.distanceMeters) ? b.distanceMeters! : Number.POSITIVE_INFINITY;
        if (leftDistance !== rightDistance) {
          return leftDistance - rightDistance;
        }
        return a.startTime.localeCompare(b.startTime);
      });

    observability.info('active_appearances_loaded', {
      latitude: query.latitude,
      longitude: query.longitude,
      radiusMeters: HAPPENING_NOW_RADIUS_METERS,
      appearanceCount: appearances.length,
    });

    return appearances;
  } catch (error) {
    observability.error(
      'active_appearances_failed',
      {
        latitude: query.latitude,
        longitude: query.longitude,
        radiusMeters: HAPPENING_NOW_RADIUS_METERS,
        reason: error instanceof Error ? error.message : 'unknown_error',
      },
      error instanceof Error ? error : undefined,
    );
    throw error;
  }
}

export async function fetchGeofenceRegions(position?: {
  latitude: number;
  longitude: number;
}): Promise<GeofenceRegion[]> {
  const search = new URLSearchParams();
  if (position) {
    search.set('lat', String(position.latitude));
    search.set('lng', String(position.longitude));
  }
  const query = search.toString();
  const response = await fetchMerchantCommerceJson<GeofenceRegionsResponse>(
    `/geofence/regions${query ? `?${query}` : ''}`,
  );
  return (response.regions ?? [])
    .filter((region) => region?.regionId && region.displayName)
    .map((region) => ({
      regionId: region.regionId!,
      displayName: region.displayName!,
      latitude: ensureNumber(region.latitude),
      longitude: ensureNumber(region.longitude),
      radiusMeters: ensureNumber(region.radiusMeters),
      distanceMeters: ensureNumber(region.distanceMeters, Number.NaN),
    }));
}

export async function markNearbyMerchantRefreshNeeded(): Promise<void> {
  await storage.setItem(REFRESH_MARKER_KEY, String(Date.now()));
}

export async function readNearbyMerchantRefreshMarker(): Promise<string | null> {
  return storage.getItem(REFRESH_MARKER_KEY);
}
