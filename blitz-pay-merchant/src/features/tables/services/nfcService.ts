import { Platform } from 'react-native';
import { observability } from '../../../lib/observability';
import { classifyNfcError, ndefUriMessageSize, NfcWriteError, type NfcWriteErrorKey } from '../nfcTag';

export type NfcAvailability = 'unsupported' | 'disabled' | 'ready';

type NfcModule = typeof import('react-native-nfc-manager');

let started = false;
let nfcModule: NfcModule | null | undefined;

/**
 * The library looks its native module up on import and throws when the running binary lacks it (Expo Go, or a dev
 * build made before react-native-nfc-manager was added). Loading it lazily keeps such a binary working without NFC.
 */
function loadNfc(): NfcModule | null {
  if (nfcModule === undefined) {
    try {
      nfcModule = require('react-native-nfc-manager') as NfcModule;
    } catch (err) {
      observability.warn('nfc_module_unavailable', { reason: err instanceof Error ? err.message : String(err) });
      nfcModule = null;
    }
  }
  return nfcModule;
}

export async function getNfcAvailability(): Promise<NfcAvailability> {
  const nfc = loadNfc();
  if (!nfc) return 'unsupported';
  const NfcManager = nfc.default;
  try {
    const supported = await NfcManager.isSupported();
    if (!supported) return 'unsupported';
    if (!started) {
      await NfcManager.start();
      started = true;
    }
    return (await NfcManager.isEnabled()) ? 'ready' : 'disabled';
  } catch (err) {
    observability.warn('nfc_availability_check_failed', {
      reason: err instanceof Error ? err.message : String(err),
    });
    return 'unsupported';
  }
}

export async function openNfcSettings(): Promise<void> {
  const nfc = loadNfc();
  if (Platform.OS !== 'android' || !nfc) return;
  const NfcManager = nfc.default;
  try {
    await NfcManager.goToNfcSetting();
  } catch (err) {
    observability.warn('nfc_open_settings_failed', { reason: err instanceof Error ? err.message : String(err) });
  }
}

function toKey(err: unknown, NfcError: NfcModule['NfcError']): NfcWriteErrorKey {
  if (err instanceof NfcError.UserCancel) return 'nfc_error_cancelled';
  if (err instanceof NfcError.TagNotWritable) return 'nfc_error_locked_tag';
  if (err instanceof NfcError.TagSizeTooSmall) return 'nfc_error_tag_too_small';
  return classifyNfcError(err);
}

/**
 * Writes the Table Link as a single NDEF URI record and then locks the tag read-only (ADR-0023).
 * The tag must be blank or writable; an already-locked tag is reported, never silently skipped.
 */
export async function writeAndLockTableLink(link: string, alertMessage: string): Promise<void> {
  const nfc = loadNfc();
  if (!nfc) throw new NfcWriteError('nfc_error_write_failed', 'nfc_module_unavailable');
  const { default: NfcManager, Ndef, NdefStatus, NfcError, NfcTech } = nfc;
  observability.info('nfc_table_tag_write_started', { linkLength: link.length });
  let step = 'request_technology';
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef, { alertMessage });

    step = 'ndef_status';
    const { status, capacity } = await NfcManager.ndefHandler.getNdefStatus();
    if (status === NdefStatus.NotSupported) {
      throw new NfcWriteError('nfc_error_unsupported_tag', `ndef_status_${status}`);
    }
    if (status === NdefStatus.ReadOnly) {
      throw new NfcWriteError('nfc_error_locked_tag', 'ndef_status_read_only');
    }
    const needed = ndefUriMessageSize(link);
    if (capacity > 0 && capacity < needed) {
      throw new NfcWriteError('nfc_error_tag_too_small', `capacity_${capacity}_needed_${needed}`);
    }

    step = 'write';
    await NfcManager.ndefHandler.writeNdefMessage(Ndef.encodeMessage([Ndef.uriRecord(link)]));

    step = 'lock';
    try {
      await NfcManager.ndefHandler.makeReadOnly();
    } catch (lockErr) {
      throw new NfcWriteError(
        'nfc_error_lock_failed',
        lockErr instanceof Error ? lockErr.message : String(lockErr),
      );
    }
    observability.info('nfc_table_tag_write_succeeded', { capacity, bytes: needed });
  } catch (err) {
    const key = toKey(err, NfcError);
    const detail = err instanceof NfcWriteError ? err.detail : err instanceof Error ? err.message : String(err);
    if (key === 'nfc_error_cancelled') {
      observability.info('nfc_table_tag_write_cancelled', { step });
    } else {
      observability.error('nfc_table_tag_write_failed', { step, key, reason: detail });
    }
    throw err instanceof NfcWriteError ? err : new NfcWriteError(key, detail);
  } finally {
    await NfcManager.cancelTechnologyRequest().catch(() => undefined);
  }
}
