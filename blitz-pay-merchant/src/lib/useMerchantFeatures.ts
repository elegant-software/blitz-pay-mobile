import { useQuery } from '@tanstack/react-query';
import { useAuth } from './auth';
import { fetchMerchantOfferings } from './merchantProducts';

const STALE_TIME = 5 * 60_000;

export function useMerchantFeatures() {
  const { activeBranchScope } = useAuth();
  const merchantId = activeBranchScope?.merchantId ?? null;

  const { data: offerings = [] } = useQuery({
    queryKey: ['merchant_offerings', merchantId],
    queryFn: () => fetchMerchantOfferings(merchantId!),
    enabled: !!merchantId,
    staleTime: STALE_TIME,
  });

  return {
    appointmentsEnabled: offerings.includes('APPOINTMENT_BOOKING'),
  };
}
