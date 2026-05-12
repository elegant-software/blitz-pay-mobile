# Merchant Portal

This context covers the merchant operator's access to branch-scoped data and actions in the BlitzPay merchant app. It exists to keep branch authorization terms explicit and separate from location-based discovery concepts.

## Language

**Merchant User**:
An authenticated operator using the merchant portal.
_Avoid_: Merchant, account, member

**Merchant Branch**:
The operational branch whose orders, products, and related data are managed in the merchant portal.
_Avoid_: Store, shop, location

**Branch Membership**:
The authorization of a Merchant User to access one Merchant Branch, derived from a branch group in the access token.
_Avoid_: Nearby branch, detected branch, location scope

**Branch Group**:
The canonical access-control group path `/merchants/merchant_<merchantId>/branch_<branchId>` carried in the access token and used to derive Branch Membership.
_Avoid_: Role, branch claim, geofence

## Relationships

- A **Merchant User** has zero or more **Branch Memberships**
- A **Branch Membership** authorizes access to exactly one **Merchant Branch**
- A **Branch Group** encodes exactly one **Branch Membership**

## Example dialogue

> **Dev:** "If a Merchant User is standing near Branch B but only has a Branch Group for Branch A, which orders can they open?"
> **Domain expert:** "Only Branch A. Branch Membership authorizes access; proximity is irrelevant."
