import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

export type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  Main: undefined;
  OrderDetail: {
    orderId: string;
    orderNumber: string;
    amount: number;
    currency?: string;
    customerName?: string;
    status: OrderStatus;
  };
  ProductEdit: {
    productId?: string;
    mode: 'create' | 'edit';
  };
  MerchantQRCode: {
    amount?: number;
    label?: string;
  };
  PaymentsHistory: undefined;
  Notifications: undefined;
};

export type TabParamList = {
  Dashboard: undefined;
  Orders: undefined;
  Products: undefined;
  Account: undefined;
};

export type OrderStatus = 'pending' | 'processing' | 'completed' | 'cancelled' | 'refunded';

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  amount: number;
  currency: string;
  status: OrderStatus;
  createdAt: string;
  items: OrderItem[];
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface Product {
  id: string;
  branchId?: string;
  name: string;
  description?: string;
  unitPrice: number;
  imageUrl?: string;
  categoryName?: string;
  productCode?: number;
  active: boolean;
}

export interface PaymentRecord {
  id: string;
  orderId?: string;
  amount: number;
  currency: string;
  method: 'bank_transfer' | 'card' | 'paypal' | 'qr';
  status: 'succeeded' | 'pending' | 'failed' | 'refunded';
  createdAt: string;
  customerName?: string;
}

export type RootStackNav = NativeStackNavigationProp<RootStackParamList>;
export type TabNav = BottomTabNavigationProp<TabParamList>;
