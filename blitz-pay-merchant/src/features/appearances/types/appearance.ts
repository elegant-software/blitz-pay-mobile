export type AppearanceStatus = 'ACTIVE' | 'UPCOMING' | 'COMPLETED' | 'CANCELLED';
export type AppearanceHistoryStatus = 'COMPLETED' | 'CANCELLED';

export type MerchantAppearance = {
  appearanceId: string;
  branchId: string;
  branchName: string;
  merchantId: string;
  name: string;
  declaredLatitude: number;
  declaredLongitude: number;
  startTime: string;
  endTime: string;
  createdAt: string;
  cancelledAt: string | null;
  status: AppearanceStatus;
};

export type AppearanceHistoryPage = {
  content: MerchantAppearance[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type AppearanceHistoryFilter = {
  status?: AppearanceHistoryStatus;
  from: string;
  to: string;
  page: number;
};

export type CreateAppearanceInput = {
  merchantId: string;
  branchId: string;
  name: string;
  declaredLatitude: number;
  declaredLongitude: number;
  startTime: string;
  endTime: string;
};
