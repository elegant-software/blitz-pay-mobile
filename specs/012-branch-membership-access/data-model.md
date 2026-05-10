# Data Model: Branch Membership Access

## Merchant User

Represents the authenticated operator using the merchant portal session.

**Fields**:

- `userId`: required unique user identifier
- `email`: optional user email used for display or support context
- `displayName`: optional user-facing name
- `merchantId`: optional merchant identifier when available from claims
- `branchMemberships`: required list of normalized authorized branch memberships
- `activeBranchId`: optional currently selected authorized branch identifier

**Validation**:

- `userId` must be present for an authenticated merchant session.
- `branchMemberships` may be empty, but empty membership blocks branch-scoped actions.
- `activeBranchId` must either be null or match one of the available `branchMemberships`.

**Relationships**:

- Owns zero or more `Branch Membership` records
- Owns zero or one `Active Branch Scope`

## Branch Membership

Represents one authorization grant from the authenticated access context to one Merchant Branch.

**Fields**:

- `groupPath`: required canonical branch group path from the authenticated claims
- `merchantId`: required merchant identifier derived from the group
- `branchId`: required branch identifier derived from the group

**Validation**:

- `groupPath` must match the canonical branch-group format documented in `CONTEXT.md`.
- `merchantId` and `branchId` must both be derivable for the membership to be considered valid.
- Duplicate memberships for the same `merchantId` and `branchId` should collapse into one normalized membership.

**Relationships**:

- Belongs to one `Merchant User`
- Can produce one `Active Branch Scope`

## Active Branch Scope

Represents the one authorized Merchant Branch currently applied to branch-scoped screens and actions.

**Fields**:

- `merchantId`: required merchant identifier
- `branchId`: required branch identifier
- `branchName`: optional resolved display name
- `source`: required scope source marker with value equivalent to branch membership authorization
- `status`: required scope status such as `resolved`, `missing`, `invalid`, or `stale`

**Validation**:

- `merchantId` and `branchId` are required when `status` is `resolved`.
- `source` must indicate authorization-derived scope, not geolocation-derived scope.
- Only one active scope may exist at a time for branch-scoped actions.

**State Transitions**:

- `missing` -> `resolved`: valid branch memberships become available and one branch is selected.
- `resolved` -> `stale`: session claims change and invalidate the current branch.
- `resolved` -> `missing`: the user loses all valid branch memberships.
- `resolved` -> `invalid`: the active branch no longer maps to a valid branch membership or cannot be resolved consistently.

## Merchant Branch

Represents the operational branch whose data is managed in the merchant portal.

**Fields**:

- `merchantId`: required parent merchant identifier
- `branchId`: required branch identifier
- `branchName`: optional branch display name
- `active`: optional branch availability flag for UI context

**Validation**:

- `merchantId` and `branchId` must match the active authorized branch scope before orders or product actions proceed.

**Relationships**:

- May be referenced by one `Active Branch Scope`
- Owns zero or many `Merchant Order Summary` and `Branch Product` records

## Merchant Order Summary

Represents one branch-scoped order row shown in the merchant portal.

**Fields**:

- `orderId`: required order identifier
- `orderNumber`: required display order number
- `merchantId`: required merchant identifier
- `branchId`: optional branch identifier from backend payload
- `status`: required normalized order status
- `createdAt`: required creation timestamp
- `customerName`: optional customer display label
- `amountMinor`: required total amount
- `currency`: required currency code

**Validation**:

- Orders displayed in the merchant portal must belong to the active authorized branch scope.
- Orders lacking minimum required identifiers are invalid and must be rejected from the mapped list.

**Relationships**:

- Belongs to one `Merchant Branch`

## Branch Product

Represents one merchant product visible or editable within an authorized branch scope.

**Fields**:

- `productId`: required product identifier
- `merchantId`: required parent merchant identifier from request context
- `branchId`: required owning branch identifier
- `name`: required product name
- `unitPrice`: required product amount
- `description`: optional descriptive text
- `categoryName`: optional category label
- `productCode`: optional merchant-facing code
- `active`: required availability flag

**Validation**:

- Product reads and writes must use the `branchId` from the active authorized branch scope.
- Product writes must be blocked if the submitted branch differs from the active authorized branch.

**Relationships**:

- Belongs to one `Merchant Branch`

## Branch Access Error State

Represents a user-visible failure or blocked state related to authorization-derived branch access.

**Fields**:

- `reasonKey`: required user-facing translation key
- `category`: required class such as `no_membership`, `invalid_membership`, `missing_scope`, or `stale_scope`
- `recoverable`: required flag indicating whether the user can retry within the current session

**Validation**:

- Error states must not include raw token values, decoded claims, or other sensitive session data.
- Error states should distinguish authorization problems from generic network failures.
