type AttributeValue = string | number | boolean | null | undefined;

const SENSITIVE_KEY_PATTERN = /(pass(word)?|token|secret|authorization|cookie)/i;

function sanitizeValue(key: string, value: AttributeValue): AttributeValue {
  if (value == null) return value;
  if (SENSITIVE_KEY_PATTERN.test(key)) return '[REDACTED]';
  if (typeof value === 'string') return value.slice(0, 500);
  return value;
}

function log(level: 'info' | 'warn' | 'error', event: string, attributes?: Record<string, AttributeValue>) {
  const payload = attributes
    ? Object.fromEntries(Object.entries(attributes).map(([key, value]) => [key, sanitizeValue(key, value)]))
    : undefined;

  const message = `[merchant-obs:${level}] ${event}`;
  if (level === 'error') {
    console.error(message, payload ?? '');
  } else if (level === 'warn') {
    console.warn(message, payload ?? '');
  } else {
    console.log(message, payload ?? '');
  }
}

export const observability = {
  info: (event: string, attributes?: Record<string, AttributeValue>) => log('info', event, attributes),
  warn: (event: string, attributes?: Record<string, AttributeValue>) => log('warn', event, attributes),
  error: (event: string, attributes?: Record<string, AttributeValue>) => log('error', event, attributes),
};
