import { useCallback, useState } from 'react';
import { config } from '../../../lib/config';
import type { RootStackParamList } from '../../../types';
import { parseTableLink, toMerchantParams } from '../tableLink';
import { resolveTableCode, TableCheckInError, type TableCheckIn } from '../services/tableCheckInService';

export const DEFAULT_GUEST_COUNT = 2;

export type TableCheckInState =
  | { phase: 'idle' }
  | { phase: 'resolving' }
  | { phase: 'guests'; checkIn: TableCheckIn; code: string }
  | { phase: 'error'; key: string; detail?: string };

export function useTableCheckIn(onReady: (params: RootStackParamList['Merchant']) => void) {
  const [state, setState] = useState<TableCheckInState>({ phase: 'idle' });

  const checkIn = useCallback(
    async (input: string) => {
      const code = parseTableLink(input, config.storefrontUrl, config.trueLayerRedirectScheme);
      if (!code) {
        setState({ phase: 'error', key: 'table_code_invalid' });
        return;
      }
      setState({ phase: 'resolving' });
      try {
        const result = await resolveTableCode(code);
        if (result.active && !result.occupied) {
          setState({ phase: 'guests', checkIn: result, code });
          return;
        }
        setState({ phase: 'idle' });
        onReady(toMerchantParams(result, code));
      } catch (err) {
        if (err instanceof TableCheckInError) {
          setState({ phase: 'error', key: err.key, detail: err.status === 404 ? undefined : err.detail });
        } else {
          setState({ phase: 'error', key: 'table_checkin_failed', detail: err instanceof Error ? err.message : undefined });
        }
      }
    },
    [onReady],
  );

  const confirmGuests = useCallback(
    (guestCount: number) => {
      if (state.phase !== 'guests') return;
      onReady(toMerchantParams(state.checkIn, state.code, guestCount));
    },
    [onReady, state],
  );

  return { state, checkIn, confirmGuests, reset: () => setState({ phase: 'idle' }) };
}
