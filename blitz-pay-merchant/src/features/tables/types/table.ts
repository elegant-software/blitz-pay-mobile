export interface TablePlacement {
  floorPlanId: string;
  /** Fraction of the Floor Plan picture width, 0..1 */
  x: number;
  /** Fraction of the Floor Plan picture height, 0..1 */
  y: number;
}

export interface BranchTable {
  id: string;
  code: string;
  name: string;
  active: boolean;
  link: string;
  /** Number of seats, 1..50; null when the merchant has not set it. */
  seats: number | null;
  placement: TablePlacement | null;
  /** When an NFC tag carrying [link] was last written for this Table (ISO); null when none was. */
  nfcTagWrittenAt: string | null;
}

export interface FloorPlan {
  id: string;
  name: string;
  imageUrl: string | null;
}

export type TableStatus = 'FREE' | 'OCCUPIED' | 'RESERVED';

export type TableOrderPaymentStatus = string;

export interface TableOrderSummary {
  orderId: string;
  pickupNumber: number | null;
  totalAmountMinor: number;
  currency: string;
  paymentStatus: TableOrderPaymentStatus;
  preparationStatus: string | null;
  createdAt: string;
}

export interface TableLive {
  table: BranchTable;
  status: TableStatus;
  occupiedSince: string | null;
  /** People at the Occupied Table right now; null when not set (free table). */
  guestCount: number | null;
  orders: TableOrderSummary[];
}

export interface BranchFloorSummary {
  totalTables: number;
  occupiedTables: number;
  seatedCapacity: number;
  occupiedSeats: number;
  totalGuests: number;
  /** Branch Capacity set by the merchant; null when not set. */
  branchCapacity: number | null;
}

export interface BranchFloor {
  floorPlans: FloorPlan[];
  tables: TableLive[];
  summary: BranchFloorSummary;
}

export interface PresignedUpload {
  storageKey: string;
  uploadUrl: string;
  expiresAt?: string;
}

export interface BranchRef {
  merchantId: string;
  branchId: string;
}
