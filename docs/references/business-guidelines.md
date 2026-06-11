# Business Guidelines

## Merchant Rules

- Merchant-facing product, branch, dashboard, order, and catalog management changes belong in `blitz-pay-merchant/`.
- Consumer-facing discovery, nearby-merchant, basket, checkout, payment, and shopper journey changes belong in `blitz-pay/`.
- If a request mentions merchants but the workflow could apply to either app, confirm whether the intent is merchant-operator or consumer-shopper before editing code.
- Merchant discovery is always geolocation-driven. Nearby merchant experiences must use the user's current or last-known location and must not fall back to static merchant lists in production flows.
- When branch context exists, show the branch name as the primary user-facing label. Merchant legal business name can be shown as secondary context.
- Merchant logos should be shown consistently anywhere branch context is presented and the logo is available from backend data.
- Merchant product, checkout, and payment flows must always preserve `merchantId` and `branchId`.

## Merchant Appearance Rules

- Appearance management belongs under `Account` → `Merchant`, not on the Dashboard, and is available only to Merchant Managers of MOBILE merchants.
- Hide Appearance navigation until `merchantMobility` is positively resolved as `MOBILE`. Unknown, missing, or failed eligibility is treated as unavailable.
- Guard the Appearance screen independently so stale navigation and deep links cannot bypass role or mobility checks. Do not call Appearance APIs when access is unavailable.
- Appearance management is scoped to the currently selected branch. Branch switching remains outside the Appearance workflow, and the screen does not aggregate other branches.
- Account shows a simple Appearance navigation row without loading active or upcoming counts.
- The merchant app shows active, upcoming, and Appearance History sections for the currently selected branch.
- Keep Appearance management and creation on separate screens. The management screen presents `Active`, `Upcoming`, and `History`; its `Create Appearance` action opens a focused creation screen with the final preview.
- Appearance History includes completed and cancelled Appearance records with branch, location, time window, and status. It does not include GPS traces.
- Web admin may aggregate Appearance History across every branch of a Mobile Merchant.
- Load the newest 20 Appearance History records initially and paginate older records.
- Retain Appearance History for one year in both merchant and web-admin views, then remove it according to the backend retention policy.
- Cancelled Appearance History records show cancellation status and timestamp without the cancelling operator's identity or a cancellation reason.
- Authorized Merchant Managers and web admins may view the exact historical Appearance location. Appearance History is not shopper-facing.
- Merchant-app Appearance History may be filtered by `Completed` or `Cancelled` status and by date range. Branch filtering belongs in web admin because the merchant workflow is already branch-scoped.
- Appearance History does not support export in the merchant app or web admin.
- New Appearances use the manager device's current location. Coordinates are not manually editable, and stored branch coordinates are not a fallback.
- Refresh device location immediately before creation. Block creation when permission is denied or current location cannot be resolved.
- Appearances may start immediately or be scheduled. A scheduled Appearance uses its creation-time location as the planned location.
- The default duration is six hours. Managers may choose another end time, up to a maximum duration of seven days.
- Appearances may be scheduled at most 30 days before their start time.
- Appearance names are required, shopper-facing, and limited to 60 characters.
- Before creation, show a final shopper-facing preview with the name, selected branch, time window, and location summary.
- Prefer a reverse-geocoded place or address in the preview. Valid coordinates may be shown to the manager when reverse geocoding fails, but raw coordinates are never shopper-facing.
- Appearance location remains unchanged after creation. Do not start automatic location tracking or expose location-update actions.
- Appearance time windows may overlap across different branches but not within the same branch.
- Active and upcoming Appearances may be cancelled after confirmation without requiring a reason. Cancelling an active Appearance immediately ends shopper visibility.
- Appearances are immutable in this workflow. Changing their schedule, name, or location requires cancellation and creation of a replacement.

## Observability Rules

- Merchant-related flows must always emit logs for request, failure, and result boundaries where backend calls or payment actions occur.
- Merchant/provider failure reasons must be logged before they are mapped to user-facing messages.
- Merchant logs must never include PII, tokens, raw banking credentials, or other sensitive payment data.

## API Contract Conventions

- Every API field backed by a closed domain value set must be documented as an OpenAPI `enum`, even when the transport model currently exposes it as `string`.
- Backend request and response DTOs must use the domain enum type for closed value sets so generated OpenAPI documents inherit the allowed values automatically. Do not maintain generated enums by editing `api-doc.yml` manually.
- Enum values in OpenAPI must exactly match the backend domain enum names. Do not introduce client aliases or separately maintained value lists.
- Apply the same enum consistently to request properties, response properties, query parameters, and array item schemas that represent the same domain concept.
- When a bounded field is required by the API, keep it in the schema's `required` list as well as declaring its enum.
- `merchantMobility` is a closed value set with `BRICK_AND_MORTAR` and `MOBILE`; all OpenAPI schemas and filters using merchant mobility must declare those values.
- Dynamic, server-managed catalogs are not OpenAPI enums. For example, `businessType` values come from the merchant vertical catalog and must remain discoverable through the verticals API rather than being frozen into the API specification.

## Implementation Notes

- Nearby merchant UI should prefer live backend responses over mocked content.
- Branch resolution must happen before product browsing and checkout.
- If merchant category, product code, logo, or branch metadata is absent in the backend response, the client should degrade gracefully without inventing placeholder business data.
