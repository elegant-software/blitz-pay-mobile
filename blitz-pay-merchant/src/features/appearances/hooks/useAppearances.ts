import { useCallback, useMemo, useState } from 'react';
import type { ActiveBranchScope, UserProfile } from '../../../lib/auth';
import {
  cancelAppearance,
  listAppearanceHistory,
  listAppearances,
  MerchantAppearanceError,
} from '../services/appearanceService';
import type { AppearanceHistoryFilter, AppearanceHistoryPage, MerchantAppearance } from '../types/appearance';

export function canViewAppearances(scope: ActiveBranchScope | null): boolean {
  return scope?.merchantMobility === 'MOBILE';
}

export function canManageAppearances(user: UserProfile | null, scope: ActiveBranchScope | null): boolean {
  return user?.role === 'MANAGER' && scope?.merchantMobility === 'MOBILE';
}

export function useAppearances(user: UserProfile | null, scope: ActiveBranchScope | null) {
  const eligible = canViewAppearances(scope);
  const canCreate = canManageAppearances(user, scope);
  const [operational, setOperational] = useState<MerchantAppearance[]>([]);
  const [history, setHistory] = useState<AppearanceHistoryPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = useMemo(() => operational.filter((item) => item.status === 'ACTIVE'), [operational]);
  const upcoming = useMemo(() => operational.filter((item) => item.status === 'UPCOMING'), [operational]);

  const loadOperational = useCallback(async () => {
    if (!eligible || !scope) return;
    setLoading(true);
    setError(null);
    try {
      setOperational(await listAppearances(scope.merchantId, scope.branchId));
    } catch (e) {
      setError(e instanceof MerchantAppearanceError ? e.detail : 'merchant_appearances_load_failed');
    } finally {
      setLoading(false);
    }
  }, [eligible, scope]);

  const loadHistory = useCallback(async (filter: AppearanceHistoryFilter) => {
    if (!eligible || !scope) return;
    setLoading(true);
    setError(null);
    try {
      setHistory(await listAppearanceHistory(scope.merchantId, scope.branchId, filter));
    } catch (e) {
      setError(e instanceof MerchantAppearanceError ? e.detail : 'merchant_appearances_load_failed');
    } finally {
      setLoading(false);
    }
  }, [eligible, scope]);

  const cancel = useCallback(async (appearanceId: string) => {
    if (!eligible || !scope) return;
    await cancelAppearance(scope.merchantId, scope.branchId, appearanceId);
    await loadOperational();
  }, [eligible, loadOperational, scope]);

  return { eligible, canCreate, active, upcoming, history, loading, error, loadOperational, loadHistory, cancel };
}
