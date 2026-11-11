import { parseInvoiceDownloadLink } from '../invoiceQr';

test('recognizes an expiring invoice PDF link scanned from the merchant or storefront', () => {
  const url = 'https://storage.example/bucket/invoices/ORD-PAID001.pdf?X-Amz-Signature=abc&X-Amz-Expires=1800';
  expect(parseInvoiceDownloadLink(url)).toBe(url);
});

test.each([
  'javascript:alert(1)', 'https://example.com/other.pdf', 'blitzpay://order/ORD-1',
  'https://example.com/invoices/ORD-1.pdf', 'not a URL',
])('does not treat %s as an invoice download', value => {
  expect(parseInvoiceDownloadLink(value)).toBeNull();
});
