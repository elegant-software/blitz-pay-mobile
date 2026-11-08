import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS, STALE_TIMES } from '../../../lib/queryClient';
import {
  createFloorPlan,
  deleteFloorPlan,
  fetchFloorPlans,
  fetchTables,
  placeTable,
  renameFloorPlan,
  unplaceTable,
  uploadFloorPlanImage,
} from '../services/tableService';
import type { BranchTable } from '../types/table';
import { clampFraction } from '../tableLogic';
import { toActionError, useBranchRef, type TableActionError } from './useBranchRef';

export function useFloorPlans() {
  const { ref, isManager } = useBranchRef();
  const queryClient = useQueryClient();
  const branchId = ref?.branchId ?? null;
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<TableActionError | null>(null);

  const plansQuery = useQuery({
    queryKey: QUERY_KEYS.floorPlans(branchId),
    queryFn: () => fetchFloorPlans(ref!),
    enabled: !!ref,
    staleTime: STALE_TIMES.BRANCH_TABLES,
  });
  const tablesQuery = useQuery({
    queryKey: QUERY_KEYS.branchTables(branchId),
    queryFn: () => fetchTables(ref!),
    enabled: !!ref,
    staleTime: STALE_TIMES.BRANCH_TABLES,
  });

  const invalidate = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.floorPlans(branchId) }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.branchTables(branchId) }),
    ]);
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.branchFloor(branchId) });
  }, [branchId, queryClient]);

  const run = useCallback(
    async (action: () => Promise<unknown>, fallbackKey: string): Promise<boolean> => {
      setBusy(true);
      setActionError(null);
      try {
        await action();
        await invalidate();
        return true;
      } catch (err) {
        setActionError(toActionError(err, fallbackKey));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [invalidate],
  );

  const setCachedPlacement = useCallback(
    (tableId: string, placement: BranchTable['placement']) => {
      queryClient.setQueryData<BranchTable[]>(QUERY_KEYS.branchTables(branchId), (tables) =>
        tables?.map((table) => (table.id === tableId ? { ...table, placement } : table)),
      );
    },
    [branchId, queryClient],
  );

  const place = useCallback(
    async (tableId: string, floorPlanId: string, x: number, y: number) => {
      if (!ref) return false;
      const placement = { floorPlanId, x: clampFraction(x), y: clampFraction(y) };
      const previous = tablesQuery.data?.find((table) => table.id === tableId)?.placement ?? null;
      setCachedPlacement(tableId, placement);
      setActionError(null);
      try {
        const saved = await placeTable(ref, tableId, placement);
        setCachedPlacement(tableId, saved.placement);
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.branchFloor(branchId) });
        return true;
      } catch (err) {
        setCachedPlacement(tableId, previous);
        setActionError(toActionError(err, 'branch_table_place_failed'));
        return false;
      }
    },
    [branchId, queryClient, ref, setCachedPlacement, tablesQuery.data],
  );

  return {
    canManage: isManager,
    floorPlans: plansQuery.data ?? [],
    tables: (tablesQuery.data ?? []).filter((table) => table.active),
    loading: plansQuery.isLoading || tablesQuery.isLoading,
    loadError: !ref
      ? { key: 'merchant_branch_access_missing' }
      : plansQuery.error
        ? toActionError(plansQuery.error, 'floor_plans_load_failed')
        : tablesQuery.error
          ? toActionError(tablesQuery.error, 'branch_tables_load_failed')
          : null,
    reload: () => Promise.all([plansQuery.refetch(), tablesQuery.refetch()]),
    busy,
    actionError,
    clearActionError: () => setActionError(null),
    create: (name: string) =>
      ref ? run(() => createFloorPlan(ref, name.trim()), 'floor_plan_create_failed') : Promise.resolve(false),
    rename: (floorPlanId: string, name: string) =>
      ref ? run(() => renameFloorPlan(ref, floorPlanId, name.trim()), 'floor_plan_rename_failed') : Promise.resolve(false),
    remove: (floorPlanId: string) =>
      ref ? run(() => deleteFloorPlan(ref, floorPlanId), 'floor_plan_delete_failed') : Promise.resolve(false),
    uploadImage: (floorPlanId: string, uri: string, mimeType?: string | null) =>
      ref
        ? run(() => uploadFloorPlanImage(ref, floorPlanId, uri, mimeType), 'floor_plan_image_upload_failed')
        : Promise.resolve(false),
    place,
    unplace: async (tableId: string) => {
      if (!ref) return false;
      return run(() => unplaceTable(ref, tableId), 'branch_table_unplace_failed');
    },
  };
}
