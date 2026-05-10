# Contract: Branch Membership Claims

## Purpose

Define how the merchant portal interprets authenticated branch authorization from token claims and how invalid claim shapes affect branch-scoped access.

## Inputs

The authenticated merchant session provides a decoded claim object that may include one or more group-style values.

## Accepted Membership Shape

Each valid branch authorization must be represented by a canonical group path with this structure:

```text
/merchants/merchant_<merchantId>/branch_<branchId>
```

## Normalization Rules

1. Each valid branch group yields exactly one normalized branch membership.
2. Duplicate group paths or duplicate derived merchant/branch pairs collapse into one membership.
3. Group values that do not contain both merchant and branch identifiers are ignored as invalid for branch access.
4. Merchant-wide or non-branch groups do not grant branch-scoped access unless they also encode one specific branch.

## Resolution Rules

1. If exactly one valid branch membership exists, it becomes the default active authorized branch scope.
2. If multiple valid branch memberships exist, the app must require or preserve one explicit active branch scope at a time.
3. If no valid branch memberships exist, branch-scoped orders and product actions are blocked.
4. If the current session changes and removes the active branch membership, the active branch scope becomes invalid until a new authorized branch is selected or resolved.

## Security Rules

1. The app must never log raw access tokens, refresh tokens, or entire decoded claim payloads.
2. The app may log non-sensitive resolution outcomes such as membership count, branch identifiers, and invalid-group counts when needed for observability.
3. User-visible error states must explain that branch access depends on authorization, not proximity.

## Output Shape

A normalized branch membership record exposes:

- `merchantId`
- `branchId`
- `groupPath`

A resolved active branch scope exposes:

- `merchantId`
- `branchId`
- `branchName` when available
- `status`
- `source` indicating authorization-derived scope
