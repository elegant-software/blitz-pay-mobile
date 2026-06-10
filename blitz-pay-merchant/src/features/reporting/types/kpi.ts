export interface OrderTypeCount {
  orderType: string;
  count: number;
}

export interface RevenueKpi {
  currency: string;
  grossAmountMinor: number;
  processingFeeMinor: number;
  platformFeeMinor: number;
  netAmountMinor: number;
  settledTransactionCount: number;
}

export interface OrderKpi {
  paidCount: number;
  pendingCount: number;
  failedOrCancelledCount: number;
  byOrderType: OrderTypeCount[];
}

export interface AppointmentKpi {
  bookedCount: number;
  completedCount: number;
  cancelledCount: number;
}

export interface PaymentMethodFrequency {
  paymentMethod: string;
  transactionCount: number;
  sharePercent: number;
}

export interface MerchantKpiReport {
  merchantId: string;
  branchId: string | null;
  from: string;
  to: string;
  revenue: RevenueKpi;
  orders: OrderKpi;
  appointments: AppointmentKpi;
  paymentMethodFrequency: PaymentMethodFrequency[];
}
