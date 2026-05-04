# Research: Geo Branch Products

## Decision: Extend the existing `merchant-catalog` mobile feature instead of creating a separate product-management module

**Rationale**: The `blitz-pay` app already contains a `merchant-catalog` feature with branch resolution, active product loading, and basket revalidation. Extending that feature keeps the implementation aligned with the repo's mandated Feature-Based + MVVM pattern and avoids duplicating merchant/branch/product mapping logic.

**Alternatives considered**:

- Build a separate product-admin feature tree: rejected because it would duplicate existing merchant catalog concerns for a single nearby-merchant workflow.
- Put API and state logic directly into a new screen: rejected because it would violate the repo architecture rules.

## Decision: Keep geolocation-driven branch resolution as the gate before any product management actions

**Rationale**: The business guidelines require geolocation-driven merchant discovery and branch-first presentation. The current mobile flow already resolves the nearest active branch from merchant branches plus the last known device position, which matches the stakeholder requirement that product operations occur only after the nearby merchant is detected.

**Alternatives considered**:

- Manual branch picker before location resolution: rejected because it weakens the geolocation-first requirement and increases the risk of editing the wrong branch.
- Merchant-wide product editing without branch resolution: rejected because the spec explicitly limits scope to a single merchant branch.

## Decision: Use the existing merchant-commerce API wrapper and add branch-scoped product mutation service methods

**Rationale**: `fetchMerchantCommerceJson` already centralizes versioned authenticated merchant-commerce calls. Adding create, detail, and update methods in the `merchant-catalog` service layer preserves one API entry point and keeps mutation behavior next to existing branch/product fetch and basket revalidation logic.

**Alternatives considered**:

- Introduce raw `fetch` calls inside screens: rejected because it bypasses the established service layer.
- Generate a new full API client: deferred because the current feature needs a narrow, already-understood merchant/product subset.

## Decision: Add dedicated product draft state separate from basket state

**Rationale**: Basket state is for shopper checkout context, not editable catalog drafts. Product add/update requires preserving unsaved input, handling stale branch/product conflicts, and surfacing field validation. That behavior belongs in a dedicated branch-product draft model and supporting hook/store, while basket state remains limited to checkout items.

**Alternatives considered**:

- Reuse basket state for editing: rejected because basket quantities and checkout summaries are not suitable for draft product management.
- Manage all edit state as local screen state only: rejected because branch refresh and retry flows benefit from controlled feature state.

## Decision: Instrument branch resolution and product mutations with structured observability

**Rationale**: The repo constitution and business guidelines require observability around merchant-related backend calls. Even though this feature is not directly a payment-provider integration, it still needs request, failure, and result logging for nearby branch resolution and product create/update calls, without logging secrets, tokens, or PII.

**Alternatives considered**:

- Keep current silent catch behavior for non-payment catalog flows: rejected because it weakens operator diagnostics and conflicts with the repo guidelines.
- Log raw request payloads including user-entered fields: rejected because it risks exposing sensitive or unnecessary data.

## Decision: Keep the operator workflow inside the existing mobile navigation and merchant/product screens

**Rationale**: The `MerchantScreen` and `ProductDetailScreen` already present the user-facing merchant catalog flow, and the requested capability is a nearby-merchant extension inside this app. Planning the feature around those existing surfaces reduces navigation churn and preserves continuity with current branch-scoped product browsing.

**Alternatives considered**:

- Create a standalone hidden admin-only app flow: rejected because it would add navigation and auth complexity not required by the spec.
- Mirror the web admin dashboard UI one-for-one: rejected because the mobile app should preserve its own interaction model while matching the same single-branch product behavior.
