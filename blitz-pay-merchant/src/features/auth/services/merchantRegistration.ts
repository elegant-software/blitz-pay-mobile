import { config } from '../../../lib/config';
import { observability } from '../../../lib/observability';
import type { TranslationKeys } from '../../../lib/translations';

export interface SignupVertical { code: string; displayName: string; }
export interface MerchantRegistrationRequest {
  ownerName: string; merchantName: string; email: string; password: string; businessType: string; operatingCountry: string;
}
export interface MerchantRegistrationResult {
  userId: string; merchantId: string; requiresBranchSetup: boolean; emailVerificationRequired: boolean; verificationEmailSent: boolean;
}
export class MerchantRegistrationError extends Error {
  constructor(readonly i18nKey: TranslationKeys, readonly detail: string | null = null, readonly status?: number) {
    super(i18nKey); this.name = 'MerchantRegistrationError';
  }
}
function safeDetail(text: string, secrets: string[] = []): string {
  let value = text;
  for (const secret of secrets) if (secret) value = value.split(secret).join('[REDACTED]');
  return value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED]').slice(0, 1000);
}
function requestContext(url: string) {
  try { const parsed = new URL(url); return {url: parsed.origin + parsed.pathname}; }
  catch { return {url: 'invalid_api_url'}; }
}
function networkFailure(event: string, url: string, error: unknown, secrets: string[] = []) {
  observability.error(event, {...requestContext(url), reason: 'network_error',
    providerReason: safeDetail(error instanceof Error ? error.message : String(error), secrets)});
  return new MerchantRegistrationError('network_error');
}
async function failure(response: Response, event: string, secrets: string[] = [], fallback: TranslationKeys = 'registration_failed', url?: string): Promise<never> {
  let detail = ''; let code = '';
  try {
    const text = await response.text();
    try {
      const body = JSON.parse(text) as {detail?: unknown; message?: unknown; error?: unknown};
      code = typeof body.error === 'string' ? body.error : '';
      const reason = body.detail ?? body.message ?? body.error;
      detail = typeof reason === 'string' ? reason : text;
    } catch { detail = text; }
  } catch { /* The status remains available when the response stream is unreadable. */ }
  const safe = detail ? safeDetail(detail, secrets) : null;
  observability.error(event, {...(url ? requestContext(url) : {}), status: response.status, reason: safe ?? 'HTTP '+response.status});
  throw new MerchantRegistrationError(code === 'email_conflict' ? 'email_conflict' : fallback, safe, response.status);
}
export async function fetchSignupVerticals(): Promise<SignupVertical[]> {
  const url = config.apiUrl.replace(/\/+$/, '')+'/v1/merchants/verticals';
  observability.info('merchant_signup_verticals_started', requestContext(url));
  let response: Response;
  try { response = await fetch(url, {method: 'GET', headers: {Accept: 'application/json'}}); }
  catch (error) {
    throw networkFailure('merchant_signup_verticals_failed', url, error);
  }
  if (!response.ok) return failure(response, 'merchant_signup_verticals_failed', [],
    response.status === 401 || response.status === 403 ? 'registration_service_unavailable' : 'registration_business_types_failed', url);
  let data: unknown;
  try { data = await response.json(); } catch {
    observability.error('merchant_signup_verticals_failed', {reason: 'invalid_response'});
    throw new MerchantRegistrationError('registration_business_types_failed');
  }
  if (!Array.isArray(data) || data.length === 0 || data.some(v => !v || typeof v.code !== 'string' || !v.code || typeof v.displayName !== 'string')) {
    observability.error('merchant_signup_verticals_failed', {reason: 'empty_or_invalid_catalogue'});
    throw new MerchantRegistrationError('registration_no_business_types');
  }
  observability.info('merchant_signup_verticals_succeeded', {count: data.length});
  return data as SignupVertical[];
}
export async function registerMerchant(input: MerchantRegistrationRequest): Promise<MerchantRegistrationResult> {
  const request: MerchantRegistrationRequest = {
    ownerName: input.ownerName.trim(), merchantName: input.merchantName.trim(), email: input.email.trim().toLowerCase(),
    password: input.password, businessType: input.businessType, operatingCountry: input.operatingCountry.trim().toUpperCase(),
  };
  const url = config.apiUrl.replace(/\/+$/, '')+'/v1/merchant-registrations';
  const secrets = [request.email, input.email, request.password, request.ownerName, request.merchantName];
  observability.info('merchant_signup_started', requestContext(url));
  let response: Response;
  try { response = await fetch(url, {
    method: 'POST', headers: {'Content-Type': 'application/json', Accept: 'application/json'}, body: JSON.stringify(request),
  }); }
  catch (error) {
    throw networkFailure('merchant_signup_failed', url, error, secrets);
  }
  if (!response.ok) return failure(response, 'merchant_signup_failed',
    secrets, 'registration_failed', url);
  let data: Partial<MerchantRegistrationResult> | null;
  try { data = await response.json(); } catch { data = null; }
  if (!data || typeof data.userId !== 'string' || !data.userId || typeof data.merchantId !== 'string' || !data.merchantId
      || typeof data.requiresBranchSetup !== 'boolean' || typeof data.emailVerificationRequired !== 'boolean' || typeof data.verificationEmailSent !== 'boolean') {
    observability.error('merchant_signup_failed', {reason: 'invalid_response', status: response.status});
    throw new MerchantRegistrationError('registration_failed');
  }
  observability.info('merchant_signup_succeeded', {requiresBranchSetup: data.requiresBranchSetup, emailVerificationRequired: data.emailVerificationRequired});
  return data as MerchantRegistrationResult;
}
export async function registerAndSignIn(request: MerchantRegistrationRequest, login: (email: string, password: string) => Promise<void>) {
  const registration = await registerMerchant(request);
  if (registration.emailVerificationRequired) return {registration, outcome: 'verification_required' as const};
  try {
    await login(request.email.trim().toLowerCase(), request.password);
    return {registration, outcome: 'authenticated' as const};
  } catch {
    observability.warn('merchant_signup_auto_login_failed', {reason: 'account_created_sign_in_required'});
    return {registration, outcome: 'login_required' as const};
  }
}
