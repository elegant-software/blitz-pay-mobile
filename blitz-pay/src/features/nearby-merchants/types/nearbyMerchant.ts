export interface NearbyMerchant {
  merchantId: string;
  merchantName: string;
  displayName: string;
  branchId?: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  geofenceRadiusMeters: number;
  googlePlaceId?: string;
  logoUrl?: string;
}

export interface ActiveAppearance {
  appearanceId: string;
  merchantId: string;
  merchantName: string;
  branchId: string;
  branchName: string;
  distanceMeters?: number;
  startTime: string;
  endTime: string;
}

export interface NearbyMerchantQuery {
  latitude: number;
  longitude: number;
  radiusMeters?: number;
}

export interface GeofenceRegion {
  regionId: string;
  displayName: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  distanceMeters?: number;
}
