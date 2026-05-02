# Data Model: Order Payment Orchestration

## Entities

### Order

Represents the backend-owned commercial record created before any payment provider flow begins.

| Field | Type | Description | Validation / Notes |
|-------|------|-------------|--------------------|
| orderId | string | Stable order reference used across checkout, payment recovery, Vault/Tresor, and merchant orders | Required, unique |
| merchantId | string | Merchant that owns the order | Required |
| branchId | string \| null | Branch context selected at checkout | Optional for payload, expected for nearby-merchant flow |
| status | enum | Canonical backend order state | Required; one of `PENDING_PAYMENT`, `PAYMENT_IN_PROGRESS`, `PAID`, `PAYMENT_FAILED`, `CANCELLED` |
| currency | string | ISO 4217 currency code | Required |
| totalAmountMinor | number | Order total in minor units | Required, `>= 0` |
| items | OrderLineItem[] | Purchased items | Required, at least one item for checkout-created orders |
| paymentChannel | enum | Selected payment routing hint on creation | Required on create; one of `TRUELAYER`, `STRIPE`, `PAYPAL` |
| lastPaymentRequestId | string \| null | Latest payment attempt reference, when one exists | Optional |
| lastPaymentProvider | string \| null | Latest provider name, when one exists | Optional |
| createdAt | string | ISO timestamp for ordering and list windows | Required |
| paidAt | string \| null | ISO timestamp of successful payment completion | Optional |

### OrderLineItem

Represents one product included in an order.

| Field | Type | Description | Validation / Notes |
|-------|------|-------------|--------------------|
| productId | string | Product identifier from merchant catalog | Required |
| name | string | Display name returned by backend on reads | Required on read |
| quantity | number | Quantity selected by shopper | Required, integer `> 0` |
| unitPriceMinor | number | Unit price in minor units | Required on read |
| lineTotalMinor | number | Extended line total in minor units | Required on read |

### Payment Attempt

Represents provider-specific progress attached to an existing order.

| Field | Type | Description | Validation / Notes |
|-------|------|-------------|--------------------|
| paymentRequestId | string | Provider/backend payment attempt id | Required once handoff starts |
| orderId | string | Owning order | Required |
| provider | enum/string | Payment provider used for the attempt | Expected values currently include TrueLayer, Stripe, Braintree/PayPal |
| status | enum | Payment-facing result state for tracking UI | Derived to `pending`, `processing`, `succeeded`, `failed`, `cancelled` |
| reason | string \| null | Raw failure/cancel reason from backend/provider | Optional, must be logged before mapping |

### Consumer Order Session

Represents in-memory state that allows checkout recovery without recreating an order.

| Field | Type | Description | Validation / Notes |
|-------|------|-------------|--------------------|
| orderId | string | Existing order under active checkout/payment handling | Required |
| merchantId | string | Merchant context | Required |
| branchId | string \| undefined | Branch context | Optional |
| selectedMethod | enum | UI payment method (`bank`, `card`, `paypal`) | Required |
| selectedChannel | enum | Backend payment channel | Required |
| orderStatus | Order.status | Latest known order status | Required |
| paymentRequestId | string \| undefined | Current or last known payment attempt | Optional |
| paymentProvider | string \| undefined | Current or last known provider | Optional |
| basketItems | BasketCheckoutItemSummary[] | Client-side basket snapshot for recovery UX | Required while session is active |

### Consumer Recent Order Entry

Represents an order rendered in Vault/Tresor.

| Field | Type | Description | Validation / Notes |
|-------|------|-------------|--------------------|
| orderId | string | Stable order reference | Required |
| createdAt | string | Used for 7-day filter and newest-first sort | Required |
| status | Order.status | Latest order/payment status shown to shopper | Required |
| isResumable | boolean | Whether resume-payment is available | True only for `PENDING_PAYMENT` and `PAYMENT_FAILED` |
| lastPaymentRequestId | string \| undefined | Enables direct navigation to processing/result when needed | Optional |

### Merchant Order List Entry

Represents an order rendered in `blitz-pay-merchant` for today’s work queue.

| Field | Type | Description | Validation / Notes |
|-------|------|-------------|--------------------|
| orderId | string | Stable order reference | Required |
| orderNumber | string | Merchant-friendly display identifier | Required |
| merchantId | string | Owning merchant | Required |
| branchId | string \| null | Branch that received the order | Optional |
| customerDisplayName | string \| null | Shopper display text if backend exposes it | Optional; treat as display-only and never log raw PII beyond UI rendering requirements |
| amountMinor | number | Total amount in minor units | Required |
| currency | string | ISO currency code | Required |
| status | enum | Merchant-visible status bucket | Expected mapping from canonical order state to `processing`, `completed`, or `cancelled`; unpaid-but-created orders may still map into `processing` for merchant UI |
| createdAt | string | Used for “today only” filter and newest-first sort | Required |

## Relationships

- One `Order` has one or more `OrderLineItem` records.
- One `Order` may have zero or many `Payment Attempt` records over time, but only one latest payment attempt is needed for this feature’s UI and recovery behavior.
- One `Consumer Order Session` references exactly one `Order`.
- One `Consumer Recent Order Entry` is a projection of one `Order`.
- One `Merchant Order List Entry` is a merchant-specific projection of one `Order`.

## State Transitions

### Canonical Order State

1. `PENDING_PAYMENT`
   - Order created, no completed payment yet.
   - Shopper may still resume payment.
2. `PAYMENT_IN_PROGRESS`
   - A payment attempt has started and is not yet terminal.
   - Shopper sees processing/pending states; merchant may still treat the order as active work depending on backend mapping.
3. `PAID`
   - Payment completed successfully.
   - Shopper resume is disabled; merchant filter should classify this as completed.
4. `PAYMENT_FAILED`
   - Latest payment attempt failed.
   - Shopper resume remains available from Vault/Tresor.
5. `CANCELLED`
   - Order was cancelled by backend/business workflow.
   - Resume disabled; merchant filter includes this under cancelled.

### Derived UI Rules

- Consumer resume-payment is available only for `PENDING_PAYMENT` and `PAYMENT_FAILED`.
- Consumer recent orders show the last 7 days, newest first by `createdAt`.
- Merchant orders show only orders created on the current day, filtered by `ALL`, `PROCESSING`, `COMPLETED`, or `CANCELLED`, and sorted newest first by `createdAt`.
- Merchant app exposes no state-transition action in this feature.
