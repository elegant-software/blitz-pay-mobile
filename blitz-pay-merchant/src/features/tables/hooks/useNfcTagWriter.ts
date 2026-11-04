import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { NfcWriteError, type NfcWriteErrorKey } from '../nfcTag';
import {
  getNfcAvailability,
  openNfcSettings,
  writeAndLockTableLink,
  type NfcAvailability,
} from '../services/nfcService';

export type NfcWriteState =
  | { phase: 'idle' }
  | { phase: 'writing' }
  | { phase: 'succeeded' }
  | { phase: 'failed'; errorKey: NfcWriteErrorKey; detail: string };

export function useNfcTagWriter() {
  const [availability, setAvailability] = useState<NfcAvailability | null>(null);
  const [state, setState] = useState<NfcWriteState>({ phase: 'idle' });

  const refreshAvailability = useCallback(async () => {
    setAvailability(await getNfcAvailability());
  }, []);

  useEffect(() => {
    void refreshAvailability();
    // Re-check when the merchant comes back from the system NFC settings.
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refreshAvailability();
    });
    return () => sub.remove();
  }, [refreshAvailability]);

  const write = useCallback(async (link: string, alertMessage: string) => {
    setState({ phase: 'writing' });
    try {
      await writeAndLockTableLink(link, alertMessage);
      setState({ phase: 'succeeded' });
    } catch (err) {
      if (err instanceof NfcWriteError && err.key === 'nfc_error_cancelled') {
        setState({ phase: 'idle' });
        return;
      }
      setState({
        phase: 'failed',
        errorKey: err instanceof NfcWriteError ? err.key : 'nfc_error_write_failed',
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  return {
    availability,
    state,
    write,
    openSettings: openNfcSettings,
    reset: () => setState({ phase: 'idle' }),
  };
}
