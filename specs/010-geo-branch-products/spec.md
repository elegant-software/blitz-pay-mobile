# Feature Specification: Geo Branch Products

**Feature Branch**: `010-nearby-merchant-product-management`  
**Created**: 2026-04-30  
**Status**: Draft  
**Input**: User description: "add geo location features similiar to blitzpay here, target is after detecting near by mechant in product page we should be able to see products information and do all operations we can do in /Users/mehdi/MyProject/blitzpay-admin-dashboard for single merchant branch, jsu about product only menas updating, adding product info"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Resolve Branch Product Scope (Priority: P1)

As an authenticated operator, I want the product page to resolve the nearby merchant and active branch from the current location context so I can work on the correct branch catalog without manually searching across unrelated merchants.

**Why this priority**: Branch resolution is the entry condition for all product work. If the wrong merchant or branch is selected, every downstream product change is unsafe.

**Independent Test**: Can be fully tested by opening the product page while a nearby merchant branch is available and verifying that the page loads the resolved merchant and branch context before showing branch products.

**Acceptance Scenarios**:

1. **Given** the operator is within range of a merchant branch, **When** the product page loads, **Then** the page resolves one nearby merchant branch and shows that branch as the active product scope.
2. **Given** multiple nearby branches could match the operator's location, **When** the page determines the active branch, **Then** the operator sees which branch was selected and can confirm they are editing products for that branch only.
3. **Given** no nearby merchant branch can be resolved, **When** the product page loads, **Then** the page shows a clear empty state and prevents product editing against an unknown branch.

---

### User Story 2 - Review Branch Product Catalog (Priority: P2)

As an authenticated operator, I want to see the current products for the resolved merchant branch, including enough detail to distinguish items, so I can understand the live branch catalog before making changes.

**Why this priority**: Operators need reliable visibility into the current branch catalog before they can safely add or update products.

**Independent Test**: Can be fully tested by resolving a branch, opening the product page, and confirming that only products belonging to that branch are shown with their current details.

**Acceptance Scenarios**:

1. **Given** the nearby branch has active products, **When** the product page loads, **Then** the page shows the current branch products with their key details and available imagery.
2. **Given** the branch has no products, **When** the product page loads, **Then** the operator sees an empty catalog state that still confirms the active merchant and branch context.
3. **Given** a product image or optional descriptive field is missing, **When** the product is displayed, **Then** the page degrades gracefully without inventing placeholder business data.

---

### User Story 3 - Add Branch Products (Priority: P3)

As an authenticated operator, I want to add a new product directly into the resolved merchant branch so I can expand the branch catalog without leaving the nearby-merchant workflow.

**Why this priority**: Adding products is one of the core catalog operations requested and becomes useful only after branch scope and product visibility are already in place.

**Independent Test**: Can be fully tested by resolving a branch, creating a new product with required details, and verifying that it appears in that branch's visible product list after save.

**Acceptance Scenarios**:

1. **Given** a branch is resolved and editable, **When** the operator enters the required new product information and saves, **Then** the new product is added to that branch catalog.
2. **Given** the operator provides optional description or image information, **When** the product is saved, **Then** the product list reflects those details when they are available.
3. **Given** required product information is missing or invalid, **When** the operator attempts to save, **Then** the page blocks the save and explains what must be corrected.

---

### User Story 4 - Update Branch Products (Priority: P4)

As an authenticated operator, I want to update an existing product for the resolved merchant branch so I can keep branch product information accurate after discovery by geolocation.

**Why this priority**: Update capability completes the requested product-management scope, but it depends on the branch already being resolved and the current catalog already being visible.

**Independent Test**: Can be fully tested by resolving a branch, editing an existing product, saving changes, and verifying the refreshed product details for that same branch.

**Acceptance Scenarios**:

1. **Given** an existing branch product, **When** the operator updates its editable information and saves, **Then** the product list reflects the latest saved details for that branch.
2. **Given** a save fails, **When** the operator remains on the edit flow, **Then** the entered values are preserved so the operator can correct and retry without re-entering everything.
3. **Given** the product changed elsewhere after the operator loaded it, **When** the operator attempts to save stale data, **Then** the page prevents silent overwrite and clearly explains that the branch product data changed.

### Edge Cases

- What happens when location permission is denied or revoked after the product page has already been opened?
- What happens when the nearby merchant can be resolved but no active branch is available for product management?
- How does the system behave when the operator moves from one merchant radius to another while editing a product?
- What happens when the selected branch becomes inactive between product list load and save?
- How does the system handle a product image that cannot be displayed even though the rest of the product data is valid?
- What happens when the operator starts adding a product but branch context refreshes before the save completes?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The product page MUST use the operator's current or last-known location context to resolve a nearby merchant before any branch product operations are shown.
- **FR-002**: The system MUST determine a single active merchant branch context before loading branch products and MUST clearly display that merchant and branch context to the operator.
- **FR-003**: The system MUST prevent product create or update actions until a valid nearby merchant branch context has been established.
- **FR-004**: When no nearby merchant branch can be resolved, the page MUST show a clear empty or blocked state explaining why product management is unavailable.
- **FR-005**: The page MUST show only products that belong to the resolved merchant branch and MUST NOT mix products from other branches in the same working view.
- **FR-006**: Each visible product entry MUST show enough detail for the operator to identify the item, including product name, current price, and any available descriptive or visual context needed to distinguish similar items.
- **FR-007**: The page MUST support viewing the current product details for a single branch product before the operator chooses to edit it.
- **FR-008**: Operators MUST be able to add a new product to the resolved merchant branch with required product information and optional descriptive or image information.
- **FR-009**: New products created from this workflow MUST be associated with the resolved merchant branch by default and MUST remain within that branch scope unless the operator explicitly changes to another valid branch context.
- **FR-010**: Operators MUST be able to update an existing product's editable information for the resolved merchant branch.
- **FR-011**: The page MUST validate required product information before create or update actions are submitted and MUST provide field-specific feedback when validation fails.
- **FR-012**: After a successful create or update action, the page MUST refresh the affected branch product list so the operator can verify the saved result in the same branch context.
- **FR-013**: If the resolved branch context changes materially during an unfinished create or update flow, the page MUST warn the operator before applying product changes under a different branch context.
- **FR-014**: If a branch or product becomes unavailable, inactive, or stale before save completion, the page MUST stop the action and explain that the operator must refresh the branch product state.
- **FR-015**: The page MUST preserve unsaved user input when a product create or update action fails for a recoverable reason.
- **FR-016**: The page MUST provide clear loading, empty, validation, success, and failure states for branch resolution, product viewing, product creation, and product updating.
- **FR-017**: The system MUST preserve merchant and branch identity on every product operation so that the affected catalog change can be traced to one merchant branch.

### Key Entities *(include if feature involves data)*

- **Nearby Merchant Context**: The merchant resolved from the operator's location context and used as the parent context for branch product management.
- **Nearby Branch Context**: The single branch selected for the current product session, including the branch identity, branch display name, and availability state used to scope product operations.
- **Branch Product**: A catalog item belonging to one merchant branch, including its identity, branch association, product name, price, descriptive content, imagery, and availability state.
- **Product Draft**: The operator-entered product information prepared for creation or update before it becomes the branch's saved product record.
- **Branch Product Session**: The operator's current working state for one resolved merchant branch, including branch identity, visible products, and any in-progress product edits.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of operators can open the product page and confirm the resolved merchant branch context within 20 seconds when a nearby branch is available.
- **SC-002**: 100% of product rows shown in the nearby-merchant workflow belong to the currently resolved branch and do not contain products from other branches.
- **SC-003**: At least 90% of operators can add a new branch product on their first attempt without consulting external documentation.
- **SC-004**: At least 90% of operators can update an existing branch product and verify the saved result within 2 minutes.
- **SC-005**: In all tested stale-context scenarios, product save attempts are blocked with a clear branch or product refresh message instead of silently applying changes to an outdated branch state.

## Assumptions

- The target user is an authenticated operator who is allowed to manage products for the resolved merchant branch.
- This feature is limited to product viewing, adding, and updating; branch creation, merchant profile editing, and payment-configuration changes are outside scope.
- Nearby merchant detection and branch resolution already exist or can be reused as the source of branch context for this workflow.
- The product page works on one resolved merchant branch at a time; cross-branch bulk editing is out of scope.
- Product imagery is optional for a valid product record, and the workflow must remain usable even when an image is missing or cannot be previewed.
- The business behavior of product add and update actions should match the established single-branch product-management workflow used in the existing admin dashboard, while staying constrained to this nearby-merchant branch context.
