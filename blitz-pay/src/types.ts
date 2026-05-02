import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { BasketCheckoutItemSummary } from './features/basket/types/basket';
import type { PaymentChannel } from './features/merchant-catalog/types/catalog';
import type { CheckoutPaymentMethod } from './features/order-payment/types/orderPayment';

export type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  Main: undefined;
  Merchant: {
    merchantId?: string;
    merchantName?: string;
    merchantLogoUrl?: string;
    distanceMeters?: number;
  };
  Checkout: {
    amount?: number;
    merchantName?: string;
    merchantId?: string;
    branchId?: string;
    branchName?: string;
    merchantLogoUrl?: string;
    activePaymentChannels?: PaymentChannel[];
    basketSummary?: string;
    basketItemCount?: number;
    basketItems?: BasketCheckoutItemSummary[];
    invoiceId?: string;
  };
  MyQRCode: undefined;
  QRScanner: undefined;
  Invoices: undefined;
  SendInvoice: undefined;
  Notifications: undefined;
  PaymentProcessing: {
    paymentRequestId: string;
    orderId?: string;
    amount?: number;
    currency?: string;
    merchantName?: string;
    branchName?: string;
    merchantLogoUrl?: string;
    invoiceId?: string;
  };
  PaymentResult: {
    paymentRequestId: string;
    orderId?: string;
    status: 'succeeded' | 'failed' | 'cancelled';
    amount?: number;
    currency?: string;
    merchantName?: string;
    branchName?: string;
    merchantLogoUrl?: string;
    paymentProvider?: string;
    reason?: string;
  };
  PaymentPending: {
    paymentRequestId: string;
    orderId?: string;
    amount?: number;
    currency?: string;
    merchantName?: string;
    branchName?: string;
    merchantLogoUrl?: string;
    basketSummary?: string;
  };
  InvoicePdfPreview: {
    localUri: string;
    invoiceNumber: string;
  };
  ProductDetail: {
    productId: string;
    name: string;
    description?: string;
    unitPrice: number;
    imageUrl?: string;
    merchantId: string;
    merchantName: string;
    branchId: string;
    branchName: string;
    merchantLogoUrl?: string;
    categoryName?: string;
    productCode?: number;
  };
  OrderDetail: {
    orderId: string;
    merchantName?: string;
    branchName?: string;
    merchantLogoUrl?: string;
    availableChannels?: PaymentChannel[];
    preferredMethod?: CheckoutPaymentMethod;
  };
};

export type TabParamList = {
  Explore: undefined;
  Assistant: undefined;
  Vault: undefined;
  Account: undefined;
};

export type RootStackNav = NativeStackNavigationProp<RootStackParamList>;
export type TabNav = BottomTabNavigationProp<TabParamList>;
