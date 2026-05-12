# Feature Specification: Branch Membership Access

**Feature Branch**: `[012-branch-membership-access]`  
**Created**: 2026-05-11  
**Status**: Draft  
**Input**: User description: "make use of Context.md to implement the feature move the details into the sepc and keep general domain related content in CONTEXT.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open Only Authorized Branch Orders (Priority: P1)

As a Merchant User, I want branch-scoped order access to come from my Branch Membership instead of my physical location so that I can only open orders for Merchant Branches I am authorized to manage.

**Why this priority**: Order access is the highest-risk merchant workflow in this context. If branch scope is derived from proximity instead of authorization, the app can expose the wrong operational data.

**Independent Test**: Can be fully tested by signing in with a Merchant User who is authorized for one branch, placing the device near a different branch, and verifying that only orders for the authorized branch can be opened.

**Acceptance Scenarios**:

1. **Given** a Merchant User has a Branch Membership for Branch A only, **When** the user opens the orders experience while physically near Branch B, **Then** the system shows and opens only Branch A orders.
2. **Given** a Merchant User has no Branch Memberships, **When** the user attempts to access branch-scoped orders, **Then** the system blocks access and explains that no authorized Merchant Branch is available.
3. **Given** a Merchant User has multiple Branch Memberships, **When** the user enters the orders experience, **Then** the system requires or applies an explicit authorized branch scope and shows orders only for that selected authorized branch.

---

### User Story 2 - Manage Products Within Authorized Branch Scope (Priority: P2)

As a Merchant User, I want product viewing and editing to stay within an authorized Merchant Branch so that branch catalog actions cannot be performed against a branch that was only discovered by geolocation.

**Why this priority**: Product management is a branch-scoped write workflow. Using the wrong branch scope could cause catalog changes in the wrong operational branch.

**Independent Test**: Can be fully tested by signing in with a Merchant User, entering the products workflow, and verifying that product lists and edit actions are limited to the Merchant Branch selected from the user’s Branch Memberships.

**Acceptance Scenarios**:

1. **Given** a Merchant User has a Branch Membership for Branch A, **When** the user opens the products workflow, **Then** the system loads products only for Branch A.
2. **Given** the device location suggests a different nearby branch than the authorized branch, **When** the user edits or adds a product, **Then** the system applies the change only to the authorized Merchant Branch.
3. **Given** the authorized branch scope cannot be established from the user’s Branch Memberships, **When** the user attempts product actions, **Then** the system prevents product loading and product changes until a valid authorized branch is available.

---

### User Story 3 - Understand Active Branch Scope Clearly (Priority: P3)

As a Merchant User, I want the app to clearly show which Merchant Branch is active and why so that I can distinguish authorization-driven branch scope from nearby-merchant context.

**Why this priority**: Clear scope communication reduces operator error and support confusion when branch access does not match the device’s location.

**Independent Test**: Can be fully tested by signing in with one or more Branch Memberships and verifying that the app shows the active Merchant Branch and does not imply that proximity granted access.

**Acceptance Scenarios**:

1. **Given** the app resolves an active Merchant Branch from Branch Membership, **When** the user views branch-scoped screens, **Then** the active branch is shown as the current scope.
2. **Given** the device is near a different branch than the active authorized branch, **When** the user views branch-scoped screens, **Then** the UI does not imply that the nearby branch is the access source.
3. **Given** a branch-scoped request is denied because the branch is not authorized, **When** the system responds to the user, **Then** the user sees a clear branch-access message without exposing sensitive token contents.

### Edge Cases

- What happens when a Merchant User has zero Branch Memberships after a successful sign-in?
- What happens when a Merchant User has multiple Branch Memberships but no previously active branch selection?
- How does the system behave when the device is near one branch while the active authorized Merchant Branch is different?
- What happens when the access token changes and removes the currently active Branch Membership during the session?
- How does the system handle a Branch Group that is malformed or incomplete and cannot be mapped to one Merchant Branch?
- What happens when the authorized Merchant Branch exists in the access token but the corresponding branch data cannot be loaded from backend systems?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST derive Merchant User branch access from Branch Groups in the authenticated access context.
- **FR-002**: Each valid Branch Group MUST map to exactly one Branch Membership and one Merchant Branch scope.
- **FR-003**: The system MUST use Branch Membership as the source of truth for branch-scoped merchant access to orders, products, and related branch data.
- **FR-004**: The system MUST NOT grant branch-scoped merchant access solely because a branch is nearby or detected from geolocation.
- **FR-005**: When a Merchant User has exactly one Branch Membership, the system MUST use that Merchant Branch as the active branch scope by default.
- **FR-006**: When a Merchant User has more than one Branch Membership, the system MUST limit branch-scoped views and actions to one explicitly active authorized Merchant Branch at a time.
- **FR-007**: When a Merchant User has no valid Branch Memberships, the system MUST block branch-scoped access and show a clear access message.
- **FR-008**: The merchant portal orders experience MUST show and open orders only for the active authorized Merchant Branch.
- **FR-009**: The merchant portal products experience MUST show, create, and update products only for the active authorized Merchant Branch.
- **FR-010**: The system MUST preserve merchant and branch identifiers on branch-scoped reads and writes so each action remains attributable to one authorized Merchant Branch.
- **FR-011**: If the active authorized Merchant Branch becomes invalid during the session, the system MUST stop branch-scoped actions and require the branch scope to be resolved again from current Branch Memberships.
- **FR-012**: The system MUST present the active Merchant Branch as the current branch scope on branch-scoped merchant screens.
- **FR-013**: Error states for unauthorized or unresolved branch access MUST explain that access depends on Branch Membership and MUST NOT expose raw token values or other sensitive identity data.
- **FR-014**: General domain terminology and relationship definitions for Merchant User, Merchant Branch, Branch Membership, and Branch Group MUST remain in the merchant portal context document.
- **FR-015**: Feature-specific behavior, user flows, scope rules, and acceptance criteria for branch-membership-based access MUST be maintained in this specification rather than embedded in `CONTEXT.md`.

### Key Entities *(include if feature involves data)*

- **Merchant User**: An authenticated operator using the merchant portal.
- **Merchant Branch**: The operational branch whose orders, products, and related data are managed in the merchant portal.
- **Branch Group**: The access-control group path carried in the authenticated access context that encodes one Merchant Branch authorization.
- **Branch Membership**: The authorization that grants a Merchant User access to exactly one Merchant Branch.
- **Active Branch Scope**: The one authorized Merchant Branch currently applied to branch-scoped screens and actions during a merchant session.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In validation scenarios where device location and authorization disagree, 100% of branch-scoped order views use the authorized Merchant Branch rather than the nearby branch.
- **SC-002**: In validation scenarios where device location and authorization disagree, 100% of branch-scoped product actions apply only to the authorized Merchant Branch.
- **SC-003**: 100% of Merchant Users with no valid Branch Memberships are blocked from branch-scoped merchant access with a clear access message.
- **SC-004**: At least 90% of Merchant Users in usability validation can identify the active authorized Merchant Branch on branch-scoped screens within 10 seconds.
- **SC-005**: Support or QA can determine from observed branch-scoped outcomes whether access was granted by Branch Membership without needing to infer scope from device location.

## Assumptions

- This feature applies to the merchant portal, not to consumer nearby-merchant discovery.
- Geolocation may still be used elsewhere in the merchant app for nearby or proximity-oriented experiences, but it is not the authorization source for branch-scoped order or product access in this feature.
- The authenticated access context already contains Branch Groups that can be parsed into Merchant Branch authorizations.
- Merchant order and product workflows continue to operate on one active Merchant Branch at a time.
- The backend and access infrastructure already recognize merchant and branch identifiers consistent with the Branch Group format documented in `CONTEXT.md`.
