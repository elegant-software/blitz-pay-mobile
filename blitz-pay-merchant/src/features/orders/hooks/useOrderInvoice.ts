import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { observability } from '../../../lib/observability';
import { fetchMerchantOrderInvoice } from '../services/orderService';
import type { ActiveBranchScope } from '../../../lib/auth';

export function useOrderInvoice(orderId: string, paid: boolean, scope: ActiveBranchScope | null) {
  const [attempt, setAttempt] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const retry = () => setAttempt(value => value + 1);

  useEffect(() => {
    let active = true;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    setUrl(null); setError(null);
    if (!orderId || !paid || !scope) { setLoading(false); return; }
    setLoading(true);
    void fetchMerchantOrderInvoice(orderId, scope).then(invoice => {
      if (!active) return;
      setUrl(invoice?.url ?? null);
      if (invoice) expiry = setTimeout(() => { if (active) setUrl(null); }, 30 * 60_000);
    }).catch((cause: unknown) => {
      if (!active) return;
      observability.warn('invoice_download_failed', { orderId });
      setError(cause instanceof Error ? ('detail' in cause && typeof cause.detail === 'string' ? cause.detail : cause.message) : '');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; if (expiry) clearTimeout(expiry); };
  }, [orderId, paid, scope?.merchantId, scope?.branchId, attempt]);

  const download = async () => {
    if (!url) return;
    setError(null);
    try { await Linking.openURL(url); }
    catch (cause) {
      observability.warn('invoice_download_open_failed', { orderId });
      setError(cause instanceof Error ? cause.message : '');
    }
  };
  return { url, loading, error, retry, download };
}
