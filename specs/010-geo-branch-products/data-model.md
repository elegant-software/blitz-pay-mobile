# Data Model: Geo Branch Products

## Nearby Merchant Context

Represents the merchant resolved from the device's current or last-known location and used as the parent context for branch-scoped product management.

**Fields**:

- `merchantId`: required merchant identifier
- `merchantName`: required legal or primary merchant display name
- `merchantLogoUrl`: optional merchant or branch image reference
- `distanceMeters`: optional distance from the operator to the resolved merchant
- `resolutionSource`: required context marker such as current position or last-known position

**Validation**:

- `merchantId` must be present before branch or product operations can begin.
- The context must only be considered editable when the location-derived merchant is successfully resolved.

**Relationships**:

- Resolves one `Nearby Branch Context`
- Owns zero or more `Branch Product` records in the current session

## Nearby Branch Context

Represents the single active branch selected for the current product-management session.

**Fields**:

- `branchId`: required branch identifier
- `merchantId`: required parent merchant identifier
- `branchName`: required branch display name
- `active`: required availability flag
- `addressSummary`: optional display address
- `latitude`: optional coordinate
- `longitude`: optional coordinate
- `distanceMeters`: optional distance from operator
- `activePaymentChannels`: optional informational payment channel list
- `imageUrl`: optional branch image reference

**Validation**:

- `branchId` is required before product list, create, or update actions.
- The branch must be active for edit actions to proceed.
- Only one branch context may be active in a product-management session.

**State Transitions**:

- `unresolved` -> `resolved`: Nearby merchant lookup finds a valid active branch.
- `resolved` -> `stale`: Device position or merchant data changes during an edit flow.
- `resolved` -> `unavailable`: Branch becomes inactive or is no longer resolvable.

## Branch Product

Represents an existing active product that belongs to the resolved merchant branch.

**Fields**:

- `productId`: required product identifier
- `merchantId`: required parent merchant identifier
- `branchId`: required owning branch identifier
- `name`: required product name
- `description`: optional descriptive text
- `unitPrice`: required monetary amount
- `imageUrl`: optional renderable image reference
- `active`: required product availability flag
- `categoryId`: optional category identifier
- `categoryName`: optional category display name
- `productCode`: optional merchant-facing product code
- `updatedAt`: optional last-updated timestamp

**Validation**:

- `name` must be present for list/detail presentation.
- `unitPrice` must be present and non-negative.
- `branchId` must match the current active branch context in the working session.

**Relationships**:

- Belongs to one `Nearby Branch Context`
- May be copied into one `Product Draft` for editing

## Product Draft

Represents the operator-entered form state used to create a new branch product or update an existing one.

**Fields**:

- `mode`: required value `create` or `update`
- `productId`: optional existing product identifier for update mode
- `merchantId`: required parent merchant identifier
- `branchId`: required active branch identifier
- `name`: required editable product name
- `description`: optional editable description
- `unitPrice`: required editable price input
- `imageFile`: optional selected image input
- `existingImageUrl`: optional current image reference for update mode
- `validationErrors`: optional field-level validation map
- `dirty`: required flag indicating unsaved changes

**Validation**:

- `name` is required.
- `unitPrice` is required and must parse to a valid non-negative monetary value.
- `branchId` must match the currently resolved branch context at save time.
- `imageFile` is optional, but image failures must not silently clear the rest of the draft.

**State Transitions**:

- `empty` -> `drafting`: Operator starts create or update flow.
- `drafting` -> `submitting`: Operator submits a valid draft.
- `submitting` -> `saved`: Service call succeeds and the branch product list refreshes.
- `submitting` -> `drafting`: Recoverable validation, stale-data, or service failure returns the draft for correction.
- `drafting` -> `abandoned`: Operator explicitly cancels or confirms discard.

## Branch Product Session

Represents the in-memory working state for one nearby branch product-management experience.

**Fields**:

- `merchantContext`: required `Nearby Merchant Context` when resolved
- `branchContext`: required `Nearby Branch Context` when resolved
- `products`: current visible `Branch Product` list for the resolved branch
- `activeDraft`: optional `Product Draft`
- `loadingState`: required status for branch resolution and product list refresh
- `errorState`: optional current blocking or recoverable error
- `lastSyncedAt`: optional timestamp of the most recent successful branch product refresh

**Validation**:

- Product mutations are blocked when `branchContext` is missing, stale, or unavailable.
- Product list entries must all match the active `branchContext.branchId`.

**Relationships**:

- Owns one active `Nearby Merchant Context`
- Owns one active `Nearby Branch Context`
- Owns zero or many visible `Branch Product` records
- Owns zero or one active `Product Draft`
