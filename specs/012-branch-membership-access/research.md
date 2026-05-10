# Research: Branch Membership Access

## Decision: Derive authorized merchant scope from authenticated branch groups instead of device location

**Rationale**: The feature specification defines `Branch Membership` as the source of truth for branch-scoped merchant access. The current merchant app uses `resolveNearbyMerchantScope` for orders and products, which is suitable for proximity experiences but incorrect for authorization. Resolving scope from authenticated branch groups prevents unauthorized access when a device is physically near a different branch.

**Alternatives considered**:

- Continue using geolocation for orders and products: rejected because it conflicts directly with the feature requirements and risks exposing the wrong branch data.
- Merge geolocation and authorization into a blended branch selector: rejected because proximity is not an access grant and would make authorization outcomes ambiguous.

## Decision: Keep one active authorized branch in session state, defaulting automatically only when exactly one membership exists

**Rationale**: The spec requires branch-scoped actions to operate on one Merchant Branch at a time. A single active branch scope keeps current screens and service APIs simple. Auto-selecting the branch only for single-membership users avoids unnecessary friction, while multi-membership users can still remain bounded to one explicit authorized branch at a time.

**Alternatives considered**:

- Implicitly select the first membership for multi-branch users: rejected because the chosen branch would be arbitrary and error-prone.
- Allow simultaneous multi-branch list aggregation: rejected because current orders and product flows are branch-scoped and the feature explicitly limits actions to one active branch.

## Decision: Parse branch groups from token claims inside the existing auth layer and expose normalized branch memberships to the app

**Rationale**: `src/lib/auth.tsx` already owns authenticated session parsing and user profile normalization. Extending that layer to parse and normalize branch groups keeps identity-derived access logic close to the session source of truth and avoids duplicating claim parsing across screens or services.

**Alternatives considered**:

- Parse raw claims independently in each screen: rejected because it duplicates logic and increases inconsistency risk.
- Defer branch parsing to backend-only filtering with no client-side active scope model: rejected because the UI still needs an explicit active branch to label screens and drive product/order requests.

## Decision: Replace local geolocation lookups in merchant branch-scoped screens with active authorized branch scope consumption

**Rationale**: `OrdersScreen`, `ProductsScreen`, and `ProductEditScreen` currently resolve scope by calling `resolveCurrentCoordinates()` and `resolveNearbyMerchantScope()`. Those screens should instead consume the active authorized branch from shared auth or merchant access state so every branch-scoped read and write uses the same authorization-derived context.

**Alternatives considered**:

- Leave screens unchanged and map nearby branches back to authorized ones later: rejected because the wrong scope would still be chosen before the request.
- Maintain separate scope sources for orders and products: rejected because it would create inconsistent branch labels and cross-screen behavior.

## Decision: Preserve current service-layer API shape and add authorization-aware validation around branch and order access

**Rationale**: Existing order and product service methods already accept merchant and branch identifiers and emit observability logs. The feature can be implemented by feeding them authorized identifiers and adding validation where detail endpoints could otherwise load data without checking active branch context.

**Alternatives considered**:

- Introduce a new repository or access-control abstraction layer: rejected because the feature can be delivered by extending existing service boundaries.
- Rewrite all merchant service modules around a new API client: deferred because the current scope only needs branch-authorization corrections.

## Decision: Add explicit unauthorized and unresolved branch UX states with i18n-backed messaging

**Rationale**: Users with zero memberships, malformed memberships, or invalid active scope need clear feedback. The current app already has error-state handling patterns for products and orders. Extending those states with branch-membership-specific messages keeps the UI understandable without exposing token internals.

**Alternatives considered**:

- Fall back silently to generic load failures: rejected because it hides the real authorization issue from users and operators.
- Display raw claim or token parsing errors: rejected because it risks leaking sensitive identity data and produces poor operator UX.

## Decision: Instrument branch-membership resolution and authorization failures without logging raw token contents

**Rationale**: Merchant backend calls and access flows require structured observability under the repo rules. The feature needs logs for branch-membership resolution start/failure/result boundaries and for branch-scoped request failures caused by missing or invalid authorized scope, while preserving security constraints around tokens and claims.

**Alternatives considered**:

- No additional logging because this is not a payment path: rejected because the business guidelines still require observability on merchant-related backend actions.
- Log entire decoded claim payloads for debugging: rejected because it unnecessarily exposes sensitive identity data.
