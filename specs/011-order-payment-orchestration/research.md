# Research: Order Payment Orchestration

## Decision: Keep `/v1/orders` as the consumer order source of truth and add a merchant-specific order-list read contract

### Rationale
- Consumer checkout already creates orders with `POST /v1/orders` and refreshes individual orders with `GET /v1/orders/{orderId}` in `blitz-pay/src/features/order-payment/services/orderPaymentService.ts`.
- Vault/Tresor resume and payment recovery depend on the same order record, so reusing the existing consumer order resource avoids duplicating state between payment endpoints and order endpoints.
- Merchant order listing has different authorization and filtering semantics than shopper order history. A merchant-specific collection endpoint keeps role boundaries explicit and avoids overloading the shopper-facing collection shape.

### Alternatives Considered
1. Extend direct provider payment endpoints only. Rejected because it breaks the order-first requirement and keeps payment recovery fragmented.
2. Use a single generic `GET /v1/orders` for both shopper and merchant lists. Rejected because consumer and merchant filters, scopes, and access controls differ enough to create ambiguous contract semantics.

## Decision: Treat backend order status as the canonical lifecycle and map it separately per app

### Rationale
- Consumer code already normalizes backend states such as `PENDING_PAYMENT`, `PAYMENT_IN_PROGRESS`, `PAID`, `PAYMENT_FAILED`, and `CANCELLED`.
- Merchant UI currently uses presentation states like `pending`, `processing`, `completed`, and `cancelled`, plus local mock data.
- Keeping one canonical backend order status model while mapping to per-app display states prevents divergent business logic and keeps payment recovery and merchant filtering aligned to the same order facts.

### Alternatives Considered
1. Give merchant app its own independent order status enum. Rejected because it would drift from payment lifecycle semantics and complicate filtering against backend data.
2. Expose payment-request status instead of order status in all UIs. Rejected because order lifecycle is the feature’s primary reference and may outlive a single payment attempt.

## Decision: Merchant orders remain read-only and scoped to today’s orders with explicit status filters

### Rationale
- The clarified spec intentionally excludes merchant-side status mutation from this feature.
- A today-only list keeps the first merchant integration bounded and avoids immediate pagination, search indexing, or historical archive concerns.
- Filters `ALL`, `PROCESSING`, `COMPLETED`, and `CANCELLED` are sufficient to separate active fulfillment work from finished or abandoned orders without adding write workflows.

### Alternatives Considered
1. Include merchant status updates now. Rejected because it expands into permissions, state-transition rules, and conflict handling not required for this release.
2. Show all historical merchant orders. Rejected because it would likely force pagination and broader query design that the current feature does not need.

## Decision: New order retrieval paths must inherit observability rules from money paths, even when they are read-only

### Rationale
- Merchant-related backend calls must emit request/failure/result logs per business and constitution guidance.
- Consumer Vault/Tresor resume decisions are operationally sensitive because they determine whether an unpaid order can be recovered safely.
- Logging backend status, filter inputs, and failure reasons without PII is necessary to debug missing orders, failed recoveries, and contract mismatches.

### Alternatives Considered
1. Instrument only payment-provider flows. Rejected because order listing and order-based recovery are part of the same payment support surface.
2. Add console logging only during development. Rejected because it does not satisfy structured telemetry requirements and is not reliable in production.
