/**
 * Soft declines: the issuer wants the PIN, so the card must be inserted and the SAME PaymentIntent processed again.
 * Only a Card Reader can take an inserted card; Tap to Pay cannot.
 */
const SOFT_DECLINE_CODES = new Set(['online_or_offline_pin_required', 'offline_pin_required']);

export function isSoftDecline(error: { apiError?: { declineCode?: string | null } } | null | undefined): boolean {
  const declineCode = error?.apiError?.declineCode;
  return !!declineCode && SOFT_DECLINE_CODES.has(declineCode);
}
