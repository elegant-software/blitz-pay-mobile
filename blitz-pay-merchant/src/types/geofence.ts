export interface GeofenceRegion {
  id: string;
  merchantId: string;
  merchantName: string;
  latitude: number;
  longitude: number;
  radius: number;
  notifyOnEnter: boolean;
  notifyOnExit: boolean;
  enabled: boolean;
}

export interface ProximityEvent {
  regionId: string;
  merchantId: string;
  eventType: 'enter' | 'exit';
  triggeredAt: string;
  location: { latitude: number; longitude: number; accuracy?: number };
  reported: boolean;
}

export interface GeofenceConfig {
  geofencingEnabled: boolean;
  pollingEnabled: boolean;
  pollingIntervalMs: number;
  backgroundPermissionGranted: boolean;
}

export interface ProximityReportPayload {
  regionId: string;
  event: 'enter' | 'exit';
  location: { latitude: number; longitude: number };
  timestamp: string;
  deviceId?: string;
}

export interface ProximityReportResponse {
  recorded: boolean;
  action: 'notify' | 'none';
}
