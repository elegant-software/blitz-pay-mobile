import React from 'react';
import { Linking } from 'react-native';
import { useOrderInvoice } from '../hooks/useOrderInvoice';
import { fetchOrderInvoice } from '../../../lib/api/shopperInvoice';
const { create, act } = require('react-test-renderer');

jest.mock('react-native', () => ({ Linking: { openURL: jest.fn() } }));
jest.mock('../../../lib/api/shopperInvoice', () => ({ fetchOrderInvoice: jest.fn() }));
jest.mock('../../../lib/observability', () => ({ observability: { warn: jest.fn() } }));
const fetchInvoice = fetchOrderInvoice as jest.Mock;
let state: ReturnType<typeof useOrderInvoice>;
function Consumer(props: { paid: boolean }) {
  state = useOrderInvoice('ORD-PAID001', props.paid);
  return null;
}
let tree: any;
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
beforeEach(() => { jest.clearAllMocks(); jest.useFakeTimers(); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.useRealTimers(); });

test('fetches on the transition to paid, opens the invoice, and retires the expired QR link', async () => {
  fetchInvoice.mockResolvedValue({ url: 'https://storage.example/invoice.pdf' });
  await act(async () => { tree = create(React.createElement(Consumer, { paid: false })); });
  expect(fetchInvoice).not.toHaveBeenCalled();
  await act(async () => tree.update(React.createElement(Consumer, { paid: true })));
  expect(state.url).toBe('https://storage.example/invoice.pdf');
  await act(async () => state.download());
  expect(Linking.openURL).toHaveBeenCalledWith('https://storage.example/invoice.pdf');
  await act(async () => jest.advanceTimersByTime(30 * 60_000));
  expect(state.url).toBeNull();
});

test('preserves backend error detail and supports a successful retry', async () => {
  fetchInvoice.mockRejectedValueOnce(new Error('Invoice storage unavailable'))
    .mockResolvedValueOnce({ url: 'https://storage.example/invoice.pdf' });
  await act(async () => { tree = create(React.createElement(Consumer, { paid: true })); });
  expect(state.error).toBe('Invoice storage unavailable');
  await act(async () => state.retry());
  expect(state.error).toBeNull();
  expect(state.url).toBe('https://storage.example/invoice.pdf');
});

test('keeps a missing invoice retryable while generation is pending', async () => {
  fetchInvoice.mockResolvedValue(null);
  await act(async () => { tree = create(React.createElement(Consumer, { paid: true })); });
  expect(state.loading).toBe(false);
  expect(state.url).toBeNull();
  expect(state.error).toBeNull();
  fetchInvoice.mockResolvedValue({ url: 'https://storage.example/invoice.pdf' });
  await act(async () => state.retry());
  expect(state.url).toBe('https://storage.example/invoice.pdf');
});

test('shows a download-opening failure and lets the shopper try again', async () => {
  fetchInvoice.mockResolvedValue({ url: 'https://storage.example/invoice.pdf' });
  (Linking.openURL as jest.Mock).mockRejectedValueOnce(new Error('Unable to open PDF'));
  await act(async () => { tree = create(React.createElement(Consumer, { paid: true })); });
  await act(async () => state.download());
  expect(state.error).toBe('Unable to open PDF');
  (Linking.openURL as jest.Mock).mockResolvedValueOnce(undefined);
  await act(async () => state.download());
  expect(state.error).toBeNull();
});
