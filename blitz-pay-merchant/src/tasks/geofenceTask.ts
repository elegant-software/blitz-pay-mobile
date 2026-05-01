import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { reportProximityIfNotCooledDown } from '../services/geofence';
import { GEOFENCE_TASK, GEOFENCE_POLL_TASK } from '../lib/geofenceConstants';

export { GEOFENCE_TASK, GEOFENCE_POLL_TASK };

TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[geofence] task error:', error.message);
    return;
  }
  const { eventType, region } = data as {
    eventType: Location.GeofencingEventType;
    region: Location.LocationRegion;
  };

  if (eventType !== Location.GeofencingEventType.Enter) return;

  const regionId = region.identifier ?? 'unknown';
  const response = await reportProximityIfNotCooledDown({
    regionId,
    merchantName: regionId,
    latitude: region.latitude,
    longitude: region.longitude,
  });

  if (response?.action === 'notify') {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'BlitzPay Merchant',
        body: `You are near your branch: ${regionId}.`,
      },
      trigger: null,
    });
  }
});

TaskManager.defineTask(GEOFENCE_POLL_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[geofence-poll] task error:', error.message);
    return;
  }
  const { locations } = data as { locations: Location.LocationObject[] };
  const position = locations?.[0];
  if (!position) return;

  const { MERCHANT_REGIONS } = await import('../lib/geofenceRegions');

  const haversineMeters = (
    lat1: number, lon1: number, lat2: number, lon2: number,
  ): number => {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  for (const region of MERCHANT_REGIONS) {
    if (!region.enabled || !region.notifyOnEnter) continue;
    const dist = haversineMeters(
      position.coords.latitude,
      position.coords.longitude,
      region.latitude,
      region.longitude,
    );
    if (dist <= region.radius) {
      const response = await reportProximityIfNotCooledDown({
        regionId: region.id,
        merchantName: region.merchantName,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      if (response?.action === 'notify') {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'BlitzPay Merchant',
            body: `You are near your branch: ${region.merchantName}.`,
          },
          trigger: null,
        });
      }
    }
  }
});
