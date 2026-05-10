# Contract: Branch Membership Access UI

## Purpose

Define the merchant-portal behavior for orders and products when branch scope is derived from Branch Membership.

## Orders Experience

1. The orders screen uses the active authorized branch scope as its only branch filter source.
2. The screen shows the active branch name as the current branch scope when available.
3. If no active authorized branch exists, the screen shows a branch-access error state instead of loading orders for a nearby branch.
4. Opening an order detail is allowed only for an order belonging to the active authorized branch scope.

## Products Experience

1. The products list uses the active authorized branch scope as its only branch filter source.
2. The products screen shows the active branch name as the current branch scope when available.
3. Product creation and product update submit only the active authorized branch identifier.
4. If no active authorized branch exists, product listing and product editing remain blocked with a branch-access error state.

## Scope Messaging

1. Branch-scoped screens must not imply that physical proximity granted access.
2. Unauthorized or unresolved branch states must use dedicated i18n-backed messaging.
3. New branch-access messages must be provided in German and English.

## Retry And Session Change Behavior

1. Retry actions re-attempt authorized branch resolution from current authenticated state.
2. If the active branch becomes invalid during the session, the affected screen exits the resolved state and blocks further branch-scoped actions until scope is restored.
3. Existing generic network errors remain distinct from authorization-derived branch errors.
