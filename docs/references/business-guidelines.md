# Business Guidelines

## Merchant Rules

- Merchant-facing product, branch, dashboard, order, and catalog management changes belong in `blitz-pay-merchant/`.
- Consumer-facing discovery, nearby-merchant, basket, checkout, payment, and shopper journey changes belong in `blitz-pay/`.
- If a request mentions merchants but the workflow could apply to either app, confirm whether the intent is merchant-operator or consumer-shopper before editing code.
- Merchant discovery is always geolocation-driven. Nearby merchant experiences must use the user's current or last-known location and must not fall back to static merchant lists in production flows.
- When branch context exists, show the branch name as the primary user-facing label. Merchant legal business name can be shown as secondary context.
- Merchant logos should be shown consistently anywhere branch context is presented and the logo is available from backend data.
- Merchant product, checkout, and payment flows must always preserve `merchantId` and `branchId`.

## Observability Rules

- Merchant-related flows must always emit logs for request, failure, and result boundaries where backend calls or payment actions occur.
- Merchant/provider failure reasons must be logged before they are mapped to user-facing messages.
- Merchant logs must never include PII, tokens, raw banking credentials, or other sensitive payment data.

## Implementation Notes

- Nearby merchant UI should prefer live backend responses over mocked content.
- Branch resolution must happen before product browsing and checkout.
- If merchant category, product code, logo, or branch metadata is absent in the backend response, the client should degrade gracefully without inventing placeholder business data.
