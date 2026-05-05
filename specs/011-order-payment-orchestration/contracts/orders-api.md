# Contract: Orders API

**Owner**: Backend team  
**Consumers**: `blitz-pay` shopper app, `blitz-pay-merchant` merchant app

## Purpose

Define the backend contract for:
- order-first checkout creation
- order status retrieval for payment recovery and shopper history
- merchant order listing for today’s read-only operations view

## 1. Create Order

**Endpoint**: `POST /v1/orders`

### Request

```json
{
  "merchantId": "merchant_123",
  "branchId": "branch_456",
  "currency": "EUR",
  "totalAmountMinor": 1599,
  "paymentChannel": "STRIPE",
  "items": [
    {
      "productId": "prod_1",
      "quantity": 2
    }
  ]
}
```

### Rules

- `paymentChannel` is required and must be one of the shopper-supported backend channels.
- `items` must contain at least one line item.
- The backend is responsible for validating merchant/branch/payment-channel compatibility.
- Successful creation returns an order reference before any provider-specific payment flow is started.

### Response — `201 Created`

```json
{
  "orderId": "ORD-B80AE533C8DE",
  "merchantId": "merchant_123",
  "branchId": "branch_456",
  "status": "PENDING_PAYMENT",
  "currency": "EUR",
  "totalAmountMinor": 1599,
  "items": [
    {
      "productId": "prod_1",
      "name": "Latte",
      "quantity": 2,
      "unitPriceMinor": 799,
      "lineTotalMinor": 1598
    }
  ],
  "createdAt": "2026-05-01T10:15:00.000Z",
  "lastPaymentRequestId": null,
  "lastPaymentProvider": null,
  "paidAt": null
}
```

### Error Expectations

- `400` / `422`: invalid payload
- `404`: merchant, branch, or product not found
- `409`: order cannot be created or selected payment channel is no longer payable

Consumer client must log request, failure, and success boundaries without logging PII.

## 2. Read Single Order

**Endpoint**: `GET /v1/orders/{orderId}`

### Purpose

Used by shopper payment recovery, payment result fallback, and Vault/Tresor order details.

### Response — `200 OK`

```json
{
  "orderId": "ORD-B80AE533C8DE",
  "merchantId": "merchant_123",
  "branchId": "branch_456",
  "status": "PAYMENT_FAILED",
  "currency": "EUR",
  "totalAmountMinor": 1599,
  "items": [
    {
      "productId": "prod_1",
      "name": "Latte",
      "quantity": 2,
      "unitPriceMinor": 799,
      "lineTotalMinor": 1598
    }
  ],
  "createdAt": "2026-05-01T10:15:00.000Z",
  "lastPaymentRequestId": "payreq_123",
  "lastPaymentProvider": "STRIPE",
  "paidAt": null
}
```

### Status Values

- `PENDING_PAYMENT`
- `PAYMENT_IN_PROGRESS`
- `PAID`
- `PAYMENT_FAILED`
- `CANCELLED`

### Client Expectations

- Shopper resume-payment is enabled only for `PENDING_PAYMENT` and `PAYMENT_FAILED`.
- `lastPaymentRequestId` may be absent when payment has not started yet.
- Unknown statuses must not crash the client; they should be treated as non-terminal until explicitly mapped.

## 3. Merchant Orders List

**Endpoint**: `GET /v1/merchant/orders`

### Purpose

Used by `blitz-pay-merchant` to show a read-only operational queue of today’s orders.

### Query Parameters

| Name | Type | Required | Notes |
|------|------|----------|-------|
| `scope` | string | no | Defaults to `today`; this feature expects only current-day orders |
| `status` | string | no | `PROCESSING`, `COMPLETED`, `CANCELLED`; omit for `ALL` |
| `branchId` | string | no | Optional branch scoping if merchant context requires it |

### Response — `200 OK`

```json
{
  "orders": [
    {
      "orderId": "ORD-B80AE533C8DE",
      "orderNumber": "1042",
      "merchantId": "merchant_123",
      "branchId": "branch_456",
      "status": "PROCESSING",
      "currency": "EUR",
      "totalAmountMinor": 1599,
      "customerDisplayName": "Anna M.",
      "createdAt": "2026-05-01T10:15:00.000Z"
    }
  ]
}
```

### Client Expectations

- Response is already limited to today’s merchant-visible orders, or equivalent when `scope=today` is supplied.
- Client sorts newest first by `createdAt` even if backend ordering changes.
- Merchant UI is read-only in this feature and uses this endpoint only for visibility/filtering.
- Empty `orders` arrays are valid and must drive an empty state instead of an error.

### Merchant Status Mapping

Backend may either:
- return merchant-ready statuses `PROCESSING`, `COMPLETED`, `CANCELLED`, or
- return canonical order statuses plus a documented mapping layer.

For this feature, the frontend contract assumes the final list item status is one of:
- `PROCESSING`
- `COMPLETED`
- `CANCELLED`

## Non-Goals

- Merchant status mutation endpoints are not part of this feature.
- Historical merchant pagination/search is not part of this feature.
- Guest checkout is not part of this feature.
