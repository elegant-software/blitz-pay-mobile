# Data Model: Pay Later Order Collaboration

## Entities

### Collaborative Order

Represents the shopper-facing and merchant-facing order record used across checkout, detail, retry, and manual follow-up surfaces.

| Field | Type | Description | Validation / Notes |
|-------|------|-------------|--------------------|
| orderId | string | Single user-visible order identifier | Required |
| merchantId | string | Owning merchant | Required |
| branchId | string | Owning branch | Required |
| checkoutIntent | enum | Original payment timing choice | Required; `PAY_NOW` or `PAY_LATER` |
| state | enum | Current order/payment business state | Required; see state model below |
| paymentSource | enum \| null | Paid-order source meaning | Null until paid; `APP_PAYMENT` or `MANUAL_SETTLEMENT` once paid |
| items | CollaborativeOrderLine[] | Current commercial lines on the order | Required |
| createdAt | string | Creation timestamp | Required |
| updatedAt | string | Latest mutation timestamp | Required |
| paymentRetryAllowed | boolean | Whether the shopper may still retry from Tresor | Required |

### Collaborative Order Line

Represents one current line in the unpaid or paid order. Duplicate product lines are allowed.

| Field | Type | Description | Validation / Notes |
|-------|------|-------------|--------------------|
| lineId | string | Stable line identifier for precise line updates | Required |
| productId | string | Product reference | Required |
| name | string | Display name | Required |
| quantity | number | Ordered quantity | Required; integer `> 0` while active |
| unitPriceMinor | number | Current line price in minor units | Required |
| lineTotalMinor | number | Current extended total | Required |
| priceSource | enum | Whether line price is catalog or merchant-overridden | Required; `CATALOG` or `MERCHANT_OVERRIDE` |

### Order Collaboration Banner

Represents the transient UI message shown when the other actor updates an unpaid order while the detail screen is open.

| Field | Type | Description | Validation / Notes |
|-------|------|-------------|--------------------|
| actor | enum | Who caused the change | Required; `MERCHANT` or `SHOPPER` |
| messageKey | string | i18n key for the banner copy | Required |
| updatedAt | string | Time of the remote change | Required |
| visibleScope | enum | Where the banner may render | Required; `ORDER_DETAIL_ONLY` |

### Manual Settlement Record

Represents merchant-entered external settlement of a qualifying unpaid order.

| Field | Type | Description | Validation / Notes |
|-------|------|-------------|--------------------|
| orderId | string | Target order | Required |
| note | string \| null | Optional merchant note | Optional |
| settledAt | string | Time of manual settlement | Required |
| paymentSource | string | Paid source meaning | Required; always `MANUAL_SETTLEMENT` |

## Relationships

- One **Collaborative Order** has one or more **Collaborative Order Line** records while active.
- One **Collaborative Order** may emit zero or more **Order Collaboration Banner** events over time, but only the current transient banner matters to each open screen.
- One **Collaborative Order** may have zero or one **Manual Settlement Record**.

## State Transitions

### Core Order State

1. `AWAITING_PAYMENT`
   - Order exists and no payment attempt is in progress.
   - Both shopper and merchant may edit before payment starts.
   - Shopper may cancel; merchant may cancel; merchant may manually settle if eligible.

2. `PAYMENT_IN_PROGRESS`
   - Payment attempt is active from `Pay now` checkout or later retry.
   - Order edits are blocked.

3. `PAYMENT_FAILED`
   - Latest payment attempt failed.
   - Shopper may reopen from Tresor and retry.
   - Merchant may still manually settle if the order remains eligible.

4. `PAID`
   - Order was paid in app or marked manually settled.
   - No further item edits.

5. `CANCELLED`
   - Order was explicitly cancelled or lost all remaining items.
   - No payment actions remain.

### Derived Rules

- `Pay later` checkout creates the order in `AWAITING_PAYMENT`.
- Successful `Pay now` checkout moves through `PAYMENT_IN_PROGRESS` and ends in `PAID`.
- Failed `Pay now` checkout ends in `PAYMENT_FAILED` without changing original `checkoutIntent`.
- Manual settlement transitions an eligible unpaid order to `PAID` with `paymentSource = MANUAL_SETTLEMENT`.
- Removing the final remaining line transitions the order to `CANCELLED`.
- Duplicate product lines remain distinct by `lineId`; merchant price override applies to one line only.
