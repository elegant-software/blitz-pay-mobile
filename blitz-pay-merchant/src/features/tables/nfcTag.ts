// NFC Forum URI Record Type Definition prefix codes, longest first so the best match wins.
const URI_PREFIXES: Array<[string, number]> = [
  ['https://www.', 0x02],
  ['http://www.', 0x01],
  ['https://', 0x04],
  ['http://', 0x03],
];

const textEncoder = new TextEncoder();

/** Bytes a single short NDEF URI record carrying `link` takes on the tag. */
export function ndefUriMessageSize(link: string): number {
  const prefix = URI_PREFIXES.find(([value]) => link.startsWith(value));
  const rest = prefix ? link.slice(prefix[0].length) : link;
  const payloadLength = 1 + textEncoder.encode(rest).length;
  // header + type length + payload length (short record) + type "U" + payload
  return 1 + 1 + (payloadLength > 255 ? 4 : 1) + 1 + payloadLength;
}

export type NfcWriteErrorKey =
  | 'nfc_error_cancelled'
  | 'nfc_error_unsupported_tag'
  | 'nfc_error_locked_tag'
  | 'nfc_error_tag_too_small'
  | 'nfc_error_lock_failed'
  | 'nfc_error_write_failed';

export class NfcWriteError extends Error {
  constructor(
    public readonly key: NfcWriteErrorKey,
    public readonly detail: string,
  ) {
    super(key);
    this.name = 'NfcWriteError';
  }
}

/** Maps a raw native error message from the NFC module to a user-facing reason. */
export function classifyNfcError(err: unknown): NfcWriteErrorKey {
  if (err instanceof NfcWriteError) return err.key;
  const message = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  if (message.includes('cancel')) return 'nfc_error_cancelled';
  if (message.includes('read only') || message.includes('read-only') || message.includes('readonly') || message.includes('not writable')) {
    return 'nfc_error_locked_tag';
  }
  if (message.includes('not ndef') || message.includes('unsupported') || message.includes('not supported')) {
    return 'nfc_error_unsupported_tag';
  }
  if (message.includes('capacity') || message.includes('too large') || message.includes('exceed')) {
    return 'nfc_error_tag_too_small';
  }
  return 'nfc_error_write_failed';
}
