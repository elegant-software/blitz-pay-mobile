import { authedFetch } from '../../../lib/api';

export interface SettlementSummaryResponse {
  merchantId: string;
  from: string;
  to: string;
  currency: string;
  transactionCount: number;
  grossAmountMinor: number;
  processingFeeMinor: number;
  platformFeeMinor: number;
  netAmountMinor: number;
  byPaymentMethod: Array<{
    paymentMethod: string;
    transactionCount: number;
    grossAmountMinor: number;
    netAmountMinor: number;
  }>;
}

export async function fetchSettlementSummary(
  merchantId: string,
  from: string,
  to: string,
): Promise<SettlementSummaryResponse> {
  const params = new URLSearchParams({ merchantId, from, to });
  const res = await authedFetch(`/v1/reporting/settlements/summary?${params.toString()}`);
  if (res.status === 404 || res.status === 204) {
    return {
      merchantId,
      from,
      to,
      currency: 'EUR',
      transactionCount: 0,
      grossAmountMinor: 0,
      processingFeeMinor: 0,
      platformFeeMinor: 0,
      netAmountMinor: 0,
      byPaymentMethod: [],
    };
  }
  if (!res.ok) throw new Error('settlements_summary_load_failed');
  return res.json() as Promise<SettlementSummaryResponse>;
}
