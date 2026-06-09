export type AppointmentStatus = 'BOOKED' | 'CANCELLED' | 'COMPLETED';

export type AppointmentContactType = 'SHOPPER_OWNED' | 'MERCHANT_CAPTURED';

export interface AppointmentResponse {
  id: string;
  merchantId: string;
  branchId: string;
  productId: string;
  productName: string;
  productCategoryId: string;
  employeeId: string | null;
  employeeName?: string | null;
  status: AppointmentStatus;
  startTime: string;
  endTime: string;
  contactType: AppointmentContactType;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  shopperAccountId: string | null;
  note: string | null;
  cancelledReason: string | null;
}

export interface MerchantBookAppointmentRequest {
  branchId: string;
  productId: string;
  productCategoryId: string;
  startTime: string;
  employeeId?: string | null;
  contactName: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  note?: string | null;
}

export interface RescheduleAppointmentRequest {
  newProductId: string;
  newProductCategoryId: string;
  newStartTime: string;
  newEmployeeId?: string | null;
}

export interface OverrideAppointmentRequest {
  reason: string;
}
