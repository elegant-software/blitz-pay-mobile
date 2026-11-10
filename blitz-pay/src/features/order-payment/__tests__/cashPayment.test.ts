jest.mock('react', () => ({
  useCallback: (callback: unknown) => callback,
  useState: jest.fn(() => [null, jest.fn()]),
  useEffect: jest.fn(),
}));
import { useEffect, useState } from 'react';
jest.mock('../../merchant-catalog/services/merchantCatalogService', () => ({ fetchMerchantBranch: jest.fn() }));
jest.mock('../services/orderPaymentService', () => ({ fetchOrder: jest.fn() }));
jest.mock('../../../lib/observability', () => ({ observability: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { useOrderCashPayment } from '../hooks/useOrderCashPayment';
import { fetchOrder } from '../services/orderPaymentService';
import { fetchMerchantBranch } from '../../merchant-catalog/services/merchantCatalogService';

const order = {
  orderId: 'order', merchantId: 'merchant', branchId: 'branch',
  checkoutIntent: 'PAY_LATER', status: 'PENDING_PAYMENT', paymentSource: undefined,
};

beforeEach(() => {
  jest.clearAllMocks();
  (useState as jest.Mock).mockReturnValue([null, jest.fn()]);
  (fetchOrder as jest.Mock).mockResolvedValue({ ...order });
  (fetchMerchantBranch as jest.Mock).mockResolvedValue({ merchantId: 'merchant', branchId: 'branch', active: true });
});

it.each(['PAID', 'CANCELLED', 'PAYMENT_IN_PROGRESS'])('hides cash for a %s order', (status) => {
  (useState as jest.Mock).mockReturnValue(['merchant:branch', jest.fn()]);
  expect(useOrderCashPayment({ ...order, status } as never).cashAvailable).toBe(false);
});

it('ignores an eligibility response after leaving the order', async () => {
  const setResolvedScope = jest.fn();
  (useState as jest.Mock).mockReturnValue([null, setResolvedScope]);
  useOrderCashPayment(order as never);
  const cleanup = (useEffect as jest.Mock).mock.calls[0][0]();
  cleanup();
  await Promise.resolve();
  expect(setResolvedScope).toHaveBeenCalledTimes(1);
  expect(setResolvedScope).toHaveBeenCalledWith(null);
});

it('offers cash for an unpaid Pay later order after its active branch resolves', async () => {
  const setResolvedScope = jest.fn();
  (useState as jest.Mock).mockReturnValue([null, setResolvedScope]);
  useOrderCashPayment(order as never);
  const effect = (useEffect as jest.Mock).mock.calls[0][0];
  effect();
  await Promise.resolve();
  expect(fetchMerchantBranch).toHaveBeenCalledWith('merchant', 'branch');
  expect(setResolvedScope).toHaveBeenLastCalledWith('merchant:branch');
  (useState as jest.Mock).mockReturnValue(['merchant:branch', setResolvedScope]);
  expect(useOrderCashPayment(order as never).cashAvailable).toBe(true);
});

it('keeps cash unpaid and checks the exact order branch without creating a payment or settlement', async () => {
  const result = await useOrderCashPayment(null).payCashToStaff('order');
  expect(fetchOrder).toHaveBeenCalledWith('order');
  expect(fetchMerchantBranch).toHaveBeenCalledWith('merchant', 'branch');
  expect(result).toEqual(order);
  expect(result.status).toBe('PENDING_PAYMENT');
  expect(result.paymentSource).toBeUndefined();
});

it.each(['PAID', 'CANCELLED', 'PAYMENT_IN_PROGRESS'])('rejects a refreshed %s order', async (status) => {
  (fetchOrder as jest.Mock).mockResolvedValue({ ...order, status });
  await expect(useOrderCashPayment(null).payCashToStaff('order')).rejects.toThrow('order_not_payable');
  expect(fetchMerchantBranch).not.toHaveBeenCalled();
});

it.each([
  { merchantId: 'merchant', branchId: 'branch', active: false },
  { merchantId: 'other', branchId: 'branch', active: true },
  { merchantId: 'merchant', branchId: 'other', active: true },
])('rejects an unavailable or mismatched branch', async (branch) => {
  (fetchMerchantBranch as jest.Mock).mockResolvedValue(branch);
  await expect(useOrderCashPayment(null).payCashToStaff('order')).rejects.toThrow('payment_option_unavailable');
});

it('does not offer cash until branch eligibility resolves', () => {
  expect(useOrderCashPayment(null).cashAvailable).toBe(false);
});
