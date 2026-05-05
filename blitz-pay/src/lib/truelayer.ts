import { Platform } from 'react-native';
import {
  Environment,
  ResultType,
  TrueLayerPaymentsSDKWrapper,
  type TrueLayerResult,
} from 'rn-truelayer-payments-sdk';
import { config } from './config';
import { observability } from './observability';
import { notifySessionExpired } from './auth';

type PaymentRequestParams = {
  token: string | null;
  amount: number;
  merchantName: string;
  orderId: string;
  merchantId?: string;
  branchId?: string;
  itemSummary?: string;
  itemCount?: number;
  invoiceId?: string;
  currency?: string;
  user?: {
    id?: string;
    email?: string;
    name?: string;
  } | null;
};

type PaymentInitResponse = {
  paymentId: string;
  resourceToken: string;
  redirectUri: string;
  environment: Environment;
  preferredCountryCode?: string;
  paymentRequestId: string;
};

type PaymentApiResponse = Record<string, unknown>;

function getRedirectUri(): string {
  return `${config.trueLayerRedirectScheme}://${config.trueLayerRedirectHost}/${config.trueLayerRedirectPath}`;
}

function logRedirectUriMismatch(expectedRedirectUri: string, actualRedirectUri: string | undefined): void {
  if (!actualRedirectUri || actualRedirectUri === expectedRedirectUri) return;
  observability.error('truelayer_redirect_mismatch', {
    expectedRedirectUri,
    actualRedirectUri,
  });
}

function getEnvironment(value: unknown): Environment {
  const normalized = typeof value === 'string' ? value.toLowerCase() : config.trueLayerEnvironment.toLowerCase();
  return normalized === 'production' ? Environment.Production : Environment.Sandbox;
}

function readString(source: PaymentApiResponse, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
}

function describeValue(source: PaymentApiResponse, keys: string[]): {
  matchedKey?: string;
  valueType: string;
  stringLength?: number;
  isEmptyString?: boolean;
} {
  for (const key of keys) {
    if (!(key in source)) continue;
    const value = source[key];
    if (typeof value === 'string') {
      return {
        matchedKey: key,
        valueType: 'string',
        stringLength: value.length,
        isEmptyString: value.trim().length === 0,
      };
    }
    if (value === null) {
      return { matchedKey: key, valueType: 'null' };
    }
    if (Array.isArray(value)) {
      return { matchedKey: key, valueType: 'array' };
    }
    return { matchedKey: key, valueType: typeof value };
  }
  return { valueType: 'missing' };
}

function extractPaymentContext(payload: PaymentApiResponse): {
  paymentId?: string;
  resourceToken?: string;
  redirectUri?: string;
  preferredCountryCode?: string;
  environment?: Environment;
  paymentRequestId?: string;
} {
  const payment = typeof payload.payment === 'object' && payload.payment ? (payload.payment as PaymentApiResponse) : undefined;
  const nested = payment ?? payload;

  const read = (keys: string[]): string | undefined =>
    readString(nested, keys) ?? (nested !== payload ? readString(payload, keys) : undefined);

  return {
    paymentId: read(['paymentId', 'payment_id', 'id']),
    resourceToken: read(['resourceToken', 'resource_token']),
    redirectUri: read(['redirectUri', 'redirect_uri', 'redirectReturnUri']),
    preferredCountryCode: read(['preferredCountryCode', 'preferred_country_code']),
    environment: (nested.environment ?? payload.environment) != null
      ? getEnvironment(nested.environment ?? payload.environment)
      : undefined,
    paymentRequestId: read(['paymentRequestId', 'payment_request_id', 'orderId', 'order_id']),
  };
}


async function createPaymentRequest({
  token,
  amount,
  merchantName,
  orderId,
  merchantId,
  branchId,
  itemSummary,
  itemCount,
  invoiceId,
  currency,
  user,
}: PaymentRequestParams): Promise<PaymentInitResponse> {
  const redirectUri = getRedirectUri();
  const hasToken = Boolean(token);

  const userDisplayName = user?.name ?? user?.email ?? 'BlitzPay Customer';
  const userEmail = user?.email?.trim() || undefined;

  const amountMinorUnits = Math.round(amount * 100);
  const requestBody = {
    orderId,
    amountMinorUnits,
    currency: (currency ?? 'EUR').toUpperCase(),
    userDisplayName,
    ...(userEmail ? { userEmail } : {}),
    redirectReturnUri: redirectUri,
  };

  observability.info('truelayer_payment_request_started', {
    url: config.trueLayerPaymentsUrl,
    orderId,
    amount,
    amountMinorUnits,
    currency: requestBody.currency,
    merchantId: merchantId ?? null,
    branchId: branchId ?? null,
    itemSummary: itemSummary ?? null,
    itemCount: itemCount ?? null,
    redirectReturnUri: redirectUri,
    hasToken,
    hasUserId: Boolean(user?.id),
    hasUserEmail: Boolean(user?.email),
    platform: Platform.OS,
  });

  let response: Response;
  try {
    response = await fetch(config.trueLayerPaymentsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(requestBody),
    });
  } catch (networkError) {
    observability.error(
      'truelayer_payment_request_network_error',
      {
        url: config.trueLayerPaymentsUrl,
        message: networkError instanceof Error ? networkError.message : String(networkError),
      },
      networkError instanceof Error ? networkError : undefined
    );
    throw new Error('truelayer_request_failed');
  }

  if (!response.ok) {
    const bodySnippet = await response
      .text()
      .then((text) => text.slice(0, 4000))
      .catch(() => '');
    observability.error('truelayer_payment_request_failed', {
      status: response.status,
      url: config.trueLayerPaymentsUrl,
      orderId,
      redirectReturnUri: redirectUri,
      body: bodySnippet,
    });
    if (response.status === 401) {
      observability.warn('auth_session_expired', {
        path: '/v1/payments/request',
        url: config.trueLayerPaymentsUrl,
        method: 'POST',
      });
      notifySessionExpired();
    }
    throw new Error(response.status === 401 ? 'session_expired' : 'truelayer_request_failed');
  }

  const payload = (await response.json().catch((err) => {
    observability.warn('truelayer_payment_response_parse_failed', {
      message: err instanceof Error ? err.message : String(err),
    });
    return {};
  })) as PaymentApiResponse;

  const context = extractPaymentContext(payload);
  const paymentIdDetails = describeValue(payload, ['paymentId', 'payment_id', 'id']);
  const nestedPayment =
    typeof payload.payment === 'object' && payload.payment ? (payload.payment as PaymentApiResponse) : undefined;
  const nestedPaymentIdDetails = nestedPayment
    ? describeValue(nestedPayment, ['paymentId', 'payment_id', 'id'])
    : { valueType: 'missing' as const };
  observability.info('truelayer_payment_request_response_received', {
    paymentRequestId: context.paymentRequestId ?? null,
    hasPaymentId: Boolean(context.paymentId),
    hasResourceToken: Boolean(context.resourceToken),
    payloadKeys: Object.keys(payload ?? {}).join(','),
  });

  if (!context.paymentRequestId || !context.paymentId || !context.resourceToken) {
    logRedirectUriMismatch(redirectUri, context.redirectUri);
    observability.error('truelayer_invalid_response', {
      paymentRequestId: context.paymentRequestId ?? null,
      hasPaymentRequestId: Boolean(context.paymentRequestId),
      hasPaymentId: Boolean(context.paymentId),
      hasResourceToken: Boolean(context.resourceToken),
      redirectUriExpected: redirectUri,
      redirectUriReturned: context.redirectUri ?? null,
      payloadKeys: Object.keys(payload ?? {}).join(','),
      paymentIdMatchedKey: paymentIdDetails.matchedKey ?? null,
      paymentIdValueType: paymentIdDetails.valueType,
      paymentIdStringLength: paymentIdDetails.stringLength ?? null,
      paymentIdIsEmptyString: paymentIdDetails.isEmptyString ?? null,
      nestedPaymentKeys: nestedPayment ? Object.keys(nestedPayment).join(',') : null,
      nestedPaymentIdMatchedKey: nestedPaymentIdDetails.matchedKey ?? null,
      nestedPaymentIdValueType: nestedPaymentIdDetails.valueType,
      nestedPaymentIdStringLength: nestedPaymentIdDetails.stringLength ?? null,
      nestedPaymentIdIsEmptyString: nestedPaymentIdDetails.isEmptyString ?? null,
      hint: 'POST /v1/payments/request must return non-empty paymentRequestId, paymentId, and resourceToken values.',
    });
    throw new Error('truelayer_invalid_response');
  }

  const normalized: PaymentInitResponse = {
    paymentId: context.paymentId,
    resourceToken: context.resourceToken,
    redirectUri: context.redirectUri ?? redirectUri,
    preferredCountryCode: context.preferredCountryCode ?? config.trueLayerPreferredCountryCode,
    environment: context.environment ?? getEnvironment(config.trueLayerEnvironment),
    paymentRequestId: context.paymentRequestId,
  };

  observability.info('truelayer_payment_request_succeeded', {
    paymentId: normalized.paymentId,
    environment: String(normalized.environment),
    redirectUri: normalized.redirectUri,
    preferredCountryCode: normalized.preferredCountryCode ?? null,
    orderId,
  });
  return normalized;
}

function normalizeResult(result: TrueLayerResult, context: { paymentId: string; redirectUri: string }): void {
  const rawReason = result.reason ?? '';
  if (result.type === ResultType.Success) {
    observability.info('truelayer_sdk_result_success', {
      paymentId: context.paymentId,
    });
    return;
  }

  const reason = rawReason.toLowerCase();
  if (reason.includes('cancel')) {
    observability.warn('truelayer_sdk_result_cancelled', {
      paymentId: context.paymentId,
      reason: rawReason,
    });
    throw new Error('truelayer_cancelled');
  }

  observability.error('truelayer_sdk_result_failed', {
    paymentId: context.paymentId,
    resultType: String(result.type),
    reason: rawReason,
    redirectUri: context.redirectUri,
  });
  throw new Error('truelayer_failed');
}

export async function createTrueLayerPayment(params: PaymentRequestParams): Promise<PaymentInitResponse> {
  if (Platform.OS === 'web') {
    throw new Error('truelayer_unsupported_platform');
  }
  return createPaymentRequest(params);
}

export async function runTrueLayerSdk(context: PaymentInitResponse): Promise<void> {
  try {
    await TrueLayerPaymentsSDKWrapper.configure(context.environment);
  } catch (err) {
    observability.error(
      'truelayer_sdk_configure_failed',
      { environment: String(context.environment), message: err instanceof Error ? err.message : String(err) },
      err instanceof Error ? err : undefined,
    );
    throw new Error('truelayer_failed');
  }

  let result: TrueLayerResult;
  try {
    observability.info('truelayer_sdk_process_payment_started', {
      paymentId: context.paymentId,
      paymentRequestId: context.paymentRequestId,
      environment: String(context.environment),
      redirectUri: context.redirectUri,
      preferredCountryCode: context.preferredCountryCode ?? null,
    });
    result = await TrueLayerPaymentsSDKWrapper.processPayment(
      { paymentId: context.paymentId, resourceToken: context.resourceToken, redirectUri: context.redirectUri },
      { shouldPresentResultScreen: true, preferredCountryCode: context.preferredCountryCode },
    );
  } catch (err) {
    observability.error(
      'truelayer_sdk_process_payment_threw',
      { paymentId: context.paymentId, message: err instanceof Error ? err.message : String(err) },
      err instanceof Error ? err : undefined,
    );
    throw new Error('truelayer_failed');
  }

  normalizeResult(result, { paymentId: context.paymentId, redirectUri: context.redirectUri });
}

export async function startTrueLayerPayment(params: PaymentRequestParams): Promise<void> {
  if (Platform.OS === 'web') {
    observability.warn('truelayer_unsupported_platform', { platform: Platform.OS });
    throw new Error('truelayer_unsupported_platform');
  }

  const context = await createPaymentRequest(params);

  try {
    observability.debug('truelayer_sdk_configure_started', {
      environment: String(context.environment),
    });
    await TrueLayerPaymentsSDKWrapper.configure(context.environment);
  } catch (err) {
    observability.error(
      'truelayer_sdk_configure_failed',
      {
        environment: String(context.environment),
        message: err instanceof Error ? err.message : String(err),
      },
      err instanceof Error ? err : undefined
    );
    throw new Error('truelayer_failed');
  }

  observability.info('truelayer_sdk_process_payment_started', {
    paymentId: context.paymentId,
    environment: String(context.environment),
    redirectUri: context.redirectUri,
    preferredCountryCode: context.preferredCountryCode ?? null,
  });

  let result: TrueLayerResult;
  try {
    result = await TrueLayerPaymentsSDKWrapper.processPayment(
      {
        paymentId: context.paymentId,
        resourceToken: context.resourceToken,
        redirectUri: context.redirectUri,
      },
      {
        shouldPresentResultScreen: true,
        preferredCountryCode: context.preferredCountryCode,
      }
    );
  } catch (err) {
    observability.error(
      'truelayer_sdk_process_payment_threw',
      {
        paymentId: context.paymentId,
        redirectUri: context.redirectUri,
        message: err instanceof Error ? err.message : String(err),
      },
      err instanceof Error ? err : undefined
    );
    throw new Error('truelayer_failed');
  }

  normalizeResult(result, { paymentId: context.paymentId, redirectUri: context.redirectUri });
}
