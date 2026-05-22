import type { TranslationKeys } from '../../lib/translations';
import type { MerchantOrderStatus } from './types/order';

export type MerchantOrderSectionKey =
  | 'payment_failed'
  | 'awaiting_payment'
  | 'payment_in_progress'
  | 'paid'
  | 'cancelled';

export const MERCHANT_ORDER_SECTION_ORDER: MerchantOrderSectionKey[] = [
  'payment_failed',
  'awaiting_payment',
  'payment_in_progress',
  'paid',
  'cancelled',
];

export const MERCHANT_ORDER_PREVIEW_COUNT: Partial<Record<MerchantOrderSectionKey, number>> = {
  payment_in_progress: 4,
  paid: 3,
  cancelled: 3,
};

export function getMerchantOrderSection(status: MerchantOrderStatus): MerchantOrderSectionKey {
  return status;
}

export function getMerchantOrderSectionTitleKey(section: MerchantOrderSectionKey): TranslationKeys {
  if (section === 'payment_failed') return 'merchant_order_queue_payment_failed';
  if (section === 'awaiting_payment') return 'merchant_order_queue_awaiting_payment';
  if (section === 'payment_in_progress') return 'merchant_order_queue_preparing';
  if (section === 'paid') return 'merchant_order_queue_completed';
  return 'merchant_order_queue_cancelled';
}

export function getMerchantOrderStatusLabelKey(status: MerchantOrderStatus): TranslationKeys {
  if (status === 'payment_failed') return 'merchant_order_queue_status_payment_failed';
  if (status === 'awaiting_payment') return 'merchant_order_queue_status_awaiting_payment';
  if (status === 'payment_in_progress') return 'merchant_order_queue_status_preparing';
  if (status === 'paid') return 'merchant_order_queue_status_completed';
  return 'merchant_order_queue_status_cancelled';
}

export function getMerchantOrderStatusIcon(status: MerchantOrderStatus): string {
  if (status === 'payment_failed') return 'alert-circle';
  if (status === 'awaiting_payment') return 'time-outline';
  if (status === 'payment_in_progress') return 'hourglass-outline';
  if (status === 'paid') return 'checkmark-circle';
  return 'ban';
}
