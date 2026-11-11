export function parseInvoiceDownloadLink(value: string): string | null {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    if (!/\/invoices\/ORD-[a-zA-Z0-9-]+\.pdf$/.test(url.pathname)) return null;
    if (!url.searchParams.get('X-Amz-Signature') || !url.searchParams.get('X-Amz-Expires')) return null;
    return value;
  } catch {
    return null;
  }
}
