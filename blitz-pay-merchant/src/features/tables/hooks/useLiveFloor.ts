import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../lib/auth';
import { observability } from '../../../lib/observability';
import { QUERY_KEYS, STALE_TIMES } from '../../../lib/queryClient';
import { useStripeTerminalPayment } from '../../../hooks/useStripeTerminalPayment';
import { markMerchantOrderManuallyPaid } from '../../orders/services/orderService';
import { clearTable, fetchBranchFloor, openFloorEvents, setGuestCount } from '../services/tableService';
import { applyTableEvent, clampGuests } from '../tableLogic';
import type { BranchFloor, TableLive } from '../types/table';
import { toActionError, useBranchRef, type TableActionError } from './useBranchRef';

const RECONNECT_MIN_MS = 2_000;
const RECONNECT_MAX_MS = 30_000;

const EMPTY_FLOOR: BranchFloor = {
  floorPlans: [],
  tables: [],
  summary: { totalTables: 0, occupiedTables: 0, seatedCapacity: 0, occupiedSeats: 0, totalGuests: 0, branchCapacity: null },
};

/**
 * The live floor: loads /floor once, then applies `table` events from the floor stream. With
 * `live: false` it only reads the shared cache (the screen underneath keeps the stream open).
 */
export function useLiveFloor({ live }: { live: boolean }) {
  const { ref } = useBranchRef();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const branchId = ref?.branchId ?? null;
  const [connected, setConnected] = useState(false);

  const query = useQuery({
    queryKey: QUERY_KEYS.branchFloor(branchId),
    queryFn: () => fetchBranchFloor(ref!),
    enabled: !!ref,
    staleTime: STALE_TIMES.BRANCH_FLOOR,
  });
  const { refetch } = query;

  useEffect(() => {
    if (!live || !ref || !token) return undefined;
    let close: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let disposed = false;

    const connect = () => {
      close = openFloorEvents(ref, token, {
        onOpen: () => {
          setConnected(true);
          // Events missed while disconnected are not replayed, so a reconnect reloads the floor.
          if (attempt > 0) void refetch();
          attempt = 0;
        },
        onTable: (tableLive) => {
          queryClient.setQueryData<BranchFloor>(QUERY_KEYS.branchFloor(ref.branchId), (floor) =>
            floor ? applyTableEvent(floor, tableLive) : floor,
          );
        },
        onClosed: (reason) => {
          setConnected(false);
          if (disposed) return;
          const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_MIN_MS * 2 ** attempt);
          attempt += 1;
          observability.info('branch_floor_events_reconnect_scheduled', { reason, delay, attempt });
          timer = setTimeout(connect, delay);
        },
      });
    };
    connect();

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      close?.();
      setConnected(false);
    };
  }, [live, queryClient, ref, refetch, token]);

  return {
    ref,
    floor: query.data ?? EMPTY_FLOOR,
    connected,
    loading: query.isLoading,
    refreshing: query.isRefetching,
    loadError: !ref
      ? { key: 'merchant_branch_access_missing' }
      : query.error
        ? toActionError(query.error, 'branch_floor_load_failed')
        : null,
    reload: refetch,
  };
}

const SETTLE_RECHECK_DELAY_MS = 1_500;

/** Actions staff take at one Table: clear it, confirm cash, or take a card with Tap to Pay. */
export function useTableActions(tableId: string) {
  const { ref } = useBranchRef();
  const queryClient = useQueryClient();
  const branchId = ref?.branchId ?? null;
  const terminal = useStripeTerminalPayment();
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [actionError, setActionError] = useState<TableActionError | null>(null);

  const refresh = useCallback(async (orderId?: string) => {
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.branchFloor(branchId) });
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ordersList(branchId) });
    if (orderId) void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.orderDetail(orderId) });
  }, [branchId, queryClient]);

  const clear = useCallback(async () => {
    if (!ref) return false;
    setClearing(true);
    setActionError(null);
    try {
      await clearTable(ref, tableId);
      await refresh();
      return true;
    } catch (err) {
      setActionError(toActionError(err, 'branch_table_clear_failed'));
      return false;
    } finally {
      setClearing(false);
    }
  }, [ref, refresh, tableId]);

  const confirmCash = useCallback(async (orderId: string, note: string) => {
    setBusyOrderId(orderId);
    setActionError(null);
    observability.info('table_cash_confirm_requested', { orderId, tableId, branchId });
    try {
      const order = await markMerchantOrderManuallyPaid(orderId, { note });
      observability.info('table_cash_confirm_result', { orderId, tableId, status: order.status });
      await refresh(orderId);
      return true;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      observability.error('table_cash_confirm_failed', { orderId, tableId, reason });
      setActionError({ key: reason || 'merchant_order_mutation_failed' });
      return false;
    } finally {
      setBusyOrderId(null);
    }
  }, [branchId, refresh, tableId]);

  const chargeWithTapToPay = useCallback(async (orderId: string) => {
    if (!ref) return false;
    setBusyOrderId(orderId);
    setActionError(null);
    terminal.reset();
    observability.info('table_tap_to_pay_requested', { orderId, tableId, branchId: ref.branchId });
    try {
      const result = await terminal.collectPayment({
        orderId,
        merchantId: ref.merchantId,
        branchId: ref.branchId,
        simulated: __DEV__,
      });
      observability.info('table_tap_to_pay_result', {
        orderId,
        tableId,
        succeeded: result.succeeded,
        reason: result.error ?? null,
      });
      if (!result.succeeded && result.error) {
        setActionError({ key: 'merchant_terminal_payment_failed', detail: result.error });
      }
      // The order becomes paid only when the provider webhook lands; give it a moment, then refresh.
      await new Promise((resolve) => setTimeout(resolve, SETTLE_RECHECK_DELAY_MS));
      await refresh(orderId);
      return result.succeeded;
    } finally {
      setBusyOrderId(null);
    }
  }, [ref, refresh, tableId, terminal]);

  const [savingGuests, setSavingGuests] = useState(false);
  const setGuests = useCallback(async (guestCount: number) => {
    if (!ref) return false;
    setSavingGuests(true);
    setActionError(null);
    try {
      const updated: TableLive = await setGuestCount(ref, tableId, clampGuests(guestCount));
      queryClient.setQueryData<BranchFloor>(QUERY_KEYS.branchFloor(branchId), (floor) =>
        floor ? applyTableEvent(floor, updated) : floor,
      );
      return true;
    } catch (err) {
      setActionError(toActionError(err, 'branch_table_guests_failed'));
      return false;
    } finally {
      setSavingGuests(false);
    }
  }, [branchId, queryClient, ref, tableId]);

  return {
    savingGuests,
    setGuests,
    busyOrderId,
    clearing,
    terminalStatus: terminal.status,
    actionError,
    clear,
    confirmCash,
    chargeWithTapToPay,
  };
}
