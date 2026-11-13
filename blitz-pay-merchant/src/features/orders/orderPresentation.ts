import type { TranslationKeys } from '../../lib/translations';
import { colors } from '../../lib/theme';
import type { FulfilmentType, MerchantOrderStatus, MerchantPreparationStatus } from './types/order';

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
  if (section === 'payment_in_progress') return 'merchant_order_queue_payment_in_progress';
  if (section === 'paid') return 'merchant_order_queue_completed';
  return 'merchant_order_queue_cancelled';
}

export function getMerchantOrderStatusLabelKey(status: MerchantOrderStatus): TranslationKeys {
  if (status === 'payment_failed') return 'merchant_order_queue_status_payment_failed';
  if (status === 'awaiting_payment') return 'merchant_order_queue_status_awaiting_payment';
  if (status === 'payment_in_progress') return 'merchant_order_queue_status_payment_in_progress';
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

export function getPreparationStatusLabelKey(status: MerchantPreparationStatus): TranslationKeys {
  if (status === 'READY') return 'merchant_preparation_status_ready';
  if (status === 'PREPARING') return 'merchant_preparation_status_preparing';
  return 'merchant_preparation_status_received';
}

export function getPreparationStatusIcon(status: MerchantPreparationStatus): string {
  if (status === 'READY') return 'bag-check-outline';
  if (status === 'PREPARING') return 'flame-outline';
  return 'receipt-outline';
}

export function getPreparationStatusColor(status: MerchantPreparationStatus): string {
  if (status === 'READY') return colors.success;
  if (status === 'PREPARING') return colors.warning;
  return colors.gray700;
}

export function formatPickupNumber(pickupNumber: number): string {
  return `#${String(pickupNumber).padStart(3, '0')}`;
}

export function parseFulfilmentType(value: unknown): FulfilmentType | null {
  return value === 'DINE_IN' || value === 'TAKE_AWAY' ? value : null;
}

export function getFulfilmentTypeLabelKey(type: FulfilmentType): TranslationKeys {
  return type === 'DINE_IN' ? 'fulfilment_type_dine_in' : 'fulfilment_type_take_away';
}

export function getFulfilmentTypeIcon(type: FulfilmentType): string {
  return type === 'DINE_IN' ? 'restaurant-outline' : 'bag-handle-outline';
}
