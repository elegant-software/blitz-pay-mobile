import { readApiError } from '../apiError';
import { observability } from '../observability';
import { authedFetch } from './authedFetch';

export class InvoiceDownloadError extends Error {
  readonly i18nKey = 'invoice_download_failed';
  constructor(public readonly detail: string, public readonly status: number) {
    super(detail);
    this.name = 'InvoiceDownloadError';
  }
}

export interface InvoiceDownloadResponse {
  url: string;
  filename: string;
}

export async function fetchOrderInvoice(orderId: string): Promise<InvoiceDownloadResponse | null> {
  const res = await authedFetch(`/v1/shopper/orders/${encodeURIComponent(orderId)}/invoice`);
  if (res.status === 404) return null;
  if (!res.ok) {
    const detail = await readApiError(res);
    observability.warn('invoice_download_failed', { orderId, status: res.status, reason: detail });
    throw new InvoiceDownloadError(detail, res.status);
  }
  return res.json() as Promise<InvoiceDownloadResponse>;
}
