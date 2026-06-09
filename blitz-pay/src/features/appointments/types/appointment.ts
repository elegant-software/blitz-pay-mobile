export interface BookableSlot {
  employeeId: string;
  employeeName: string;
  startTime: string;
  endTime: string;
}

export type AppointmentStatus = 'BOOKED' | 'CANCELLED' | 'COMPLETED';

export interface AppointmentResponse {
  id: string;
  merchantId: string;
  branchId: string;
  employeeId: string;
  productId: string;
  productName: string;
  productPrice: number | null;
  shopperAccountId: string | null;
  status: string; // backend returns string, not enum
  contactType: string;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  startTime: string;
  endTime: string;
  note: string | null;
  durationMinutes: number;
  createdAt: string;
  updatedAt: string;
  // Optional fields not always present in backend response
  productCategoryId?: string;
  employeeName?: string | null;
  cancelledReason?: string | null;
}

export interface ShopperBookAppointmentRequest {
  branchId: string;
  productId: string;
  productCategoryId: string;
  startTime: string;
  employeeId?: string;
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  note?: string;
}

export interface RescheduleRequest {
  newProductId: string;
  newProductCategoryId: string;
  newStartTime: string;
  newEmployeeId?: string;
}

export interface SearchSlotsRequest {
  branchId: string;
  productCategoryId: string;
  employeeId?: string;
  from: string;
  to: string;
}
