import { useMemo } from 'react';
import { useAuth } from '../../../lib/auth';
import type { BranchRef } from '../types/table';
import { TableError } from '../services/tableService';

export function useBranchRef(): { ref: BranchRef | null; isManager: boolean } {
  const { activeBranchScope, user } = useAuth();
  const merchantId = activeBranchScope?.merchantId ?? null;
  const branchId = activeBranchScope?.branchId ?? null;
  const ref = useMemo(
    () => (merchantId && branchId ? { merchantId, branchId } : null),
    [merchantId, branchId],
  );
  return { ref, isManager: user?.role === 'MANAGER' };
}

export interface TableActionError {
  key: string;
  detail?: string;
}

export function toActionError(err: unknown, fallbackKey: string): TableActionError {
  if (err instanceof TableError) return { key: err.key, detail: err.detail };
  return { key: fallbackKey, detail: err instanceof Error ? err.message : undefined };
}
