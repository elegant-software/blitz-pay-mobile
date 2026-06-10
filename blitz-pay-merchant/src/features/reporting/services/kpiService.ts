import { authedFetch } from '../../../lib/api';
import type { MerchantKpiReport } from '../types/kpi';

export async function fetchMerchantKpi(
  merchantId: string,
  from: string,
  to: string,
  branchId?: string | null,
): Promise<MerchantKpiReport> {
  const params = new URLSearchParams({ from, to });
  if (branchId) params.set('branchId', branchId);
  const res = await authedFetch(
    `/v1/reporting/dashboard/merchant/${encodeURIComponent(merchantId)}?${params.toString()}`,
  );
  if (!res.ok) throw new Error('merchant_kpi_load_failed');
  return res.json() as Promise<MerchantKpiReport>;
}
