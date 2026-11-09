import { useCallback, useEffect, useState } from 'react';
import { config } from './config';

export type LegalInfo = { termsVersion: string; termsUrl: string; privacyUrl: string };

// The backend owns the terms version in force and the per-language document links.
export async function fetchLegal(lang: string): Promise<LegalInfo> {
  const res = await fetch(`${config.apiUrl}/v1/legal?lang=${encodeURIComponent(lang)}`);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

export function useLegal(lang: string) {
  const [legal, setLegal] = useState<LegalInfo | null>(null);
  const reload = useCallback(() => {
    let current = true;
    fetchLegal(lang).then((l) => current && setLegal(l)).catch(() => current && setLegal(null));
    return () => { current = false; };
  }, [lang]);
  useEffect(reload, [reload]);
  return { legal, reload };
}
