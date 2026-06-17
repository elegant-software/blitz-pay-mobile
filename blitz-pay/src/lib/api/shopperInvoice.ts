import { authedFetch } from './authedFetch';

export interface InvoiceDownloadResponse {
  url: string;
  filename: string;
}

export async function fetchOrderInvoice(orderId: string): Promise<InvoiceDownloadResponse | null> {
  const res = await authedFetch(`/v1/shopper/orders/${orderId}/invoice`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('invoice_load_failed');
  return res.json() as Promise<InvoiceDownloadResponse>;
}
