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

**Merchant Action Queue**:
The default merchant order-screen view that prioritises orders needing operational follow-up ahead of in-progress, completed, and cancelled orders.
_Avoid_: Flat history, customer list, generic recent orders

**Shopper Identity Withholding**:
The privacy rule that the merchant portal UI must not expose shopper personal identity anywhere in the merchant app.
_Avoid_: Customer name display, shopper profile visibility, identity lookup from orders

## Relationships

- A **Merchant User** has zero or more **Branch Memberships**
- A **Branch Membership** authorizes access to exactly one **Merchant Branch**
- A **Branch Group** encodes exactly one **Branch Membership**
- A **Merchant Action Queue** belongs to exactly one **Merchant Branch**
- A **Merchant Action Queue** prioritises orders needing merchant action over reference/history states
- **Shopper Identity Withholding** applies across the entire merchant portal UI within one **Merchant Branch**

## Example dialogue

> **Dev:** "If a Merchant User is standing near Branch B but only has a Branch Group for Branch A, which orders can they open?"
> **Domain expert:** "Only Branch A. Branch Membership authorizes access; proximity is irrelevant."
