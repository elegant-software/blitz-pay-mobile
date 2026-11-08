import type { RootStackParamList } from '../../types';
import type { TableCheckIn } from './services/tableCheckInService';

// Table Codes use this alphabet only (no 0/O/1/I/L), so typed codes cannot be ambiguous.
const TABLE_CODE = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;

/** Normalises a typed Table Code: case-insensitive, spaces and dashes ignored. */
export function normalizeTableCode(input: string): string | null {
  const code = input.replace(/[\s-]+/g, '').toUpperCase();
  return TABLE_CODE.test(code) ? code : null;
}

/** "https://shop.example.com:8443/x" → "shop.example.com:8443" */
export function hostOf(url: string | null | undefined): string | null {
  const match = /^https?:\/\/([^/?#]+)/i.exec(url?.trim() ?? '');
  return match ? match[1].toLowerCase() : null;
}

/**
 * Extracts the Table Code from a Table Link (`https://<storefront host>/t/{code}`), the app scheme
 * (`blitzpay://t/{code}`) or a bare code. Links on any other host are rejected.
 */
export function parseTableLink(input: string, storefrontUrl: string | null | undefined, appScheme: string): string | null {
  const value = input.trim();
  const direct = normalizeTableCode(value);
  if (direct) return direct;

  const web = /^https?:\/\/([^/?#]+)\/t\/([^/?#]+)\/?(?:[?#].*)?$/i.exec(value);
  if (web) {
    const expectedHost = hostOf(storefrontUrl);
    if (!expectedHost || web[1].toLowerCase() !== expectedHost) return null;
    return normalizeTableCode(decodeURIComponent(web[2]));
  }

  const scheme = new RegExp(`^${appScheme}://t/([^/?#]+)/?(?:[?#].*)?$`, 'i').exec(value);
  if (scheme) return normalizeTableCode(decodeURIComponent(scheme[1]));

  return null;
}

/** Merchant screen params for a resolved check-in; a deactivated Table opens the branch for counter pickup. */
export function toMerchantParams(
  checkIn: TableCheckIn,
  code: string,
  guestCount?: number,
): RootStackParamList['Merchant'] {
  const base = {
    merchantId: checkIn.merchantId,
    merchantName: checkIn.merchantName,
    branchId: checkIn.branchId,
    branchName: checkIn.branchName,
  };
  if (!checkIn.active || !checkIn.tableName) return { ...base, counterPickup: true };
  return { ...base, tableCode: code, tableName: checkIn.tableName, guestCount };
}
