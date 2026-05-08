import RNBlobUtil from 'react-native-blob-util';
import { config } from '../lib/config';
import { notifySessionExpired } from '../lib/auth';
import type { InvoiceFormState, GeneratedPdf } from '../types/invoice';

export async function generateInvoicePdf(
  data: InvoiceFormState,
  token: string,
): Promise<GeneratedPdf> {
  const url = 'https://api-blitzpay-staging.elegantsoftware.de/v1/invoices';
  const filename = `invoice-${data.invoiceNumber}.pdf`;
  const path = `${RNBlobUtil.fs.dirs.CacheDir}/${filename}`;

  const body = {
    invoiceNumber: data.invoiceNumber,
    issueDate: data.issueDate,
    dueDate: data.dueDate,
    currency: data.currency,
    seller: {
      name: data.seller.name,
      street: data.seller.street,
      zip: data.seller.zip,
      city: data.seller.city,
      country: data.seller.country,
      ...(data.seller.vatId ? { vatId: data.seller.vatId } : {}),
    },
    buyer: {
      name: data.buyer.name,
      street: data.buyer.street,
      zip: data.buyer.zip,
      city: data.buyer.city,
      country: data.buyer.country,
      ...(data.buyer.vatId ? { vatId: data.buyer.vatId } : {}),
    },
    lineItems: data.lineItems.map((item) => ({
      description: item.description,
      quantity: parseFloat(item.quantity),
      unitPrice: parseFloat(item.unitPrice),
      vatPercent: parseFloat(item.vatPercent),
    })),
    ...(data.bankAccount.iban
      ? {
          bankAccount: {
            bankName: data.bankAccount.bankName,
            iban: data.bankAccount.iban,
            bic: data.bankAccount.bic,
          },
        }
      : {}),
    ...(data.footerText ? { footerText: data.footerText } : {}),
  };

  console.log('[invoiceService] POST', url, body);

  let response: { respInfo: { status: number }; path: () => string };
  try {
    response = await RNBlobUtil.config({ fileCache: true, path }).fetch(
      'POST',
      url,
      {
        'Content-Type': 'application/json',
        Accept: 'application/pdf',
        Authorization: `Bearer ${token}`,
      },
      JSON.stringify(body),
    );
    console.log('[invoiceService] response status', response.respInfo.status);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[invoiceService] fetch error', message);
    const isNetwork =
      message === 'Network request failed' ||
      message.toLowerCase().includes('network') ||
      message.toLowerCase().includes('fetch') ||
      message.toLowerCase().includes('connect');
    throw new Error(isNetwork ? 'error_server_unreachable' : 'error_pdf_generation_failed');
  }

  if (response.respInfo.status === 401) {
    await RNBlobUtil.fs.unlink(path).catch(() => {});
    notifySessionExpired();
    throw new Error('error_session_expired');
  }

  if (response.respInfo.status !== 200) {
    console.warn('[invoiceService] non-200 status', response.respInfo.status);
    await RNBlobUtil.fs.unlink(path).catch(() => {});
    throw new Error('error_pdf_generation_failed');
  }

  const stat = await RNBlobUtil.fs.stat(path);
  if (stat.size === 0) {
    await RNBlobUtil.fs.unlink(path).catch(() => {});
    throw new Error('error_pdf_generation_failed');
  }

  return { localUri: `file://${path}`, filename };
}
