import { authedFetch } from './authedFetch';

export interface ShopperProfileResponse {
  name: string;
  street: string;
  zip: string;
  city: string;
  country: string;
}

export interface UpsertShopperProfileRequest {
  name: string;
  street: string;
  zip: string;
  city: string;
  country: string;
}

export async function fetchShopperProfile(): Promise<ShopperProfileResponse | null> {
  const res = await authedFetch('/v1/shopper/profile');
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('shopper_profile_load_failed');
  return res.json() as Promise<ShopperProfileResponse>;
}

export async function upsertShopperProfile(
  request: UpsertShopperProfileRequest,
): Promise<ShopperProfileResponse> {
  const res = await authedFetch('/v1/shopper/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error('shopper_profile_save_failed');
  return res.json() as Promise<ShopperProfileResponse>;
}

export async function deleteShopperProfile(): Promise<void> {
  const res = await authedFetch('/v1/shopper/profile', { method: 'DELETE' });
  if (!res.ok) throw new Error('shopper_profile_delete_failed');
}
