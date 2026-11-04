import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS, STALE_TIMES } from '../../../lib/queryClient';
import {
  createTables,
  deleteTable,
  fetchBranchFloor,
  fetchTables,
  TableError,
  updateTable,
} from '../services/tableService';
import { exceedsBranchCapacity, parseBulkTableNames, seatedCapacity } from '../tableLogic';
import { toActionError, useBranchRef, type TableActionError } from './useBranchRef';

export function useTableSetup() {
  const { ref, isManager } = useBranchRef();
  const queryClient = useQueryClient();
  const branchId = ref?.branchId ?? null;
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<TableActionError | null>(null);

  const query = useQuery({
    queryKey: QUERY_KEYS.branchTables(branchId),
    queryFn: () => fetchTables(ref!),
    enabled: !!ref,
    staleTime: STALE_TIMES.BRANCH_TABLES,
  });

  // Branch Capacity comes with the floor summary; only used to warn, never to block.
  const floorQuery = useQuery({
    queryKey: QUERY_KEYS.branchFloor(branchId),
    queryFn: () => fetchBranchFloor(ref!),
    enabled: !!ref,
    staleTime: STALE_TIMES.BRANCH_FLOOR,
  });
  const tables = query.data ?? [];
  const seated = seatedCapacity(tables);
  const branchCapacity = floorQuery.data?.summary.branchCapacity ?? null;

  const run = useCallback(
    async (action: () => Promise<unknown>, fallbackKey: string): Promise<boolean> => {
      setBusy(true);
      setActionError(null);
      try {
        await action();
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.branchTables(branchId) });
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.branchFloor(branchId) });
        return true;
      } catch (err) {
        if (err instanceof TableError && err.status === 409 && fallbackKey === 'tables_delete_failed') {
          setActionError({ key: 'tables_delete_has_orders' });
        } else {
          setActionError(toActionError(err, fallbackKey));
        }
        return false;
      } finally {
        setBusy(false);
      }
    },
    [branchId, queryClient],
  );

  return {
    ref,
    canManage: isManager,
    tables,
    seatedCapacity: seated,
    branchCapacity,
    capacityExceeded: exceedsBranchCapacity(seated, branchCapacity),
    loading: query.isLoading,
    loadError: !ref
      ? { key: 'merchant_branch_access_missing' }
      : query.error
        ? toActionError(query.error, 'branch_tables_load_failed')
        : null,
    reload: query.refetch,
    busy,
    actionError,
    clearActionError: () => setActionError(null),
    createFromInput: async (input: string, seats: number | null) => {
      const names = parseBulkTableNames(input);
      if (!ref || names.length === 0) return false;
      return run(() => createTables(ref, names, seats), 'branch_tables_create_failed');
    },
    setSeats: (tableId: string, seats: number | null) =>
      ref ? run(() => updateTable(ref, tableId, { seats }), 'branch_table_update_failed') : Promise.resolve(false),
    rename: (tableId: string, name: string) =>
      ref ? run(() => updateTable(ref, tableId, { name: name.trim() }), 'branch_table_update_failed') : Promise.resolve(false),
    setActive: (tableId: string, active: boolean) =>
      ref ? run(() => updateTable(ref, tableId, { active }), 'branch_table_update_failed') : Promise.resolve(false),
    remove: (tableId: string) =>
      ref ? run(() => deleteTable(ref, tableId), 'tables_delete_failed') : Promise.resolve(false),
  };
}
