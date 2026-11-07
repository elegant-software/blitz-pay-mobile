const merchantGroup = /^\/merchants\/merchant_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
export function isMerchantGroup(path: string): boolean { return merchantGroup.test(path); }
export function merchantIdFromGroups(paths: string[]): string | null {
  const ids = new Set(paths.map(path => path.match(merchantGroup)?.[1]?.toLowerCase()).filter((id): id is string => !!id));
  return ids.size === 1 ? Array.from(ids)[0] : null;
}
