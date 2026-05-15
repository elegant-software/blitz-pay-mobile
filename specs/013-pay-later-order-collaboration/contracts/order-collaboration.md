# Order Collaboration Contract

This feature depends on the backend exposing a richer order contract than the current order-first flow alone.

## Consumer Checkout Expectations

- Merchant context for shopper flows exposes whether delayed payment is available for the merchant.
- Checkout supports two timing choices:
  - `Pay now`
  - `Pay later`
- `Pay later` order creation does not require payment-method selection at create time.
- `Pay now` order creation records the chosen payment method and starts payment immediately.

## Order Read Expectations

Both apps rely on order reads that expose:

- `orderId`
- original checkout intent
- current business state
- current items and totals
- retry eligibility
- payment source once paid

## Unpaid Order Mutation Expectations

Before payment starts, the apps expect backend support for:

- add item
- change quantity
- remove item
- shopper cancel
- merchant cancel
- merchant line price override

Each successful mutation returns the latest full order snapshot for immediate UI refresh.

## Manual Settlement Expectations

Merchant-side manual settlement requires:

- eligibility for original `Pay later` orders
- eligibility for failed `Pay now` orders that remain unpaid
- optional note
- paid result with `MANUAL_SETTLEMENT` source
- order lock after settlement

## State Presentation Expectations

The apps expect the backend contract to support these meanings directly:

- awaiting payment
- payment in progress
- payment failed
- paid
- cancelled

The merchant app also relies on the distinction between:

- unpaid order waiting for its first payment
- unpaid order whose latest payment attempt failed
