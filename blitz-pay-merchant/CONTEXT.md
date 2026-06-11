# Merchant Portal

This context covers the merchant operator's access to branch-scoped data and actions in the BlitzPay merchant app. It exists to keep branch authorization terms explicit and separate from location-based discovery concepts.

## Language

**Merchant User**:
An authenticated operator using the merchant portal.
_Avoid_: Merchant, account, member

**Merchant Branch**:
The operational branch whose orders, products, and related data are managed in the merchant portal.
_Avoid_: Store, shop, location

**Mobile Merchant**:
A Merchant whose business operates through changing physical locations; the classification applies to every Merchant Branch.
_Avoid_: Mobile branch, mixed merchant

**Merchant Manager**:
A Merchant User authorized to configure merchant-wide capabilities and public shopper-discovery behavior.
_Avoid_: Employee, branch member

**Appearance**:
A scheduled, time-bounded live presence of one **Merchant Branch** belonging to a **Mobile Merchant** that a **Merchant User** can create or cancel.
_Avoid_: Live toggle, nearby merchant, branch location

**Appearance History**:
The record of completed or cancelled Appearances, including their branch, location, time window, and status.
_Avoid_: Movement history, GPS trace

**Branch Membership**:
The authorization of a Merchant User to access one Merchant Branch, derived from a branch group in the access token.
_Avoid_: Nearby branch, detected branch, location scope

**Branch Group**:
The canonical access-control group path `/merchants/merchant_<merchantId>/branch_<branchId>` carried in the access token and used to derive Branch Membership.
_Avoid_: Role, branch claim, geofence

**Merchant Action Queue**:
The default merchant order-screen view that prioritises orders needing operational follow-up ahead of in-progress, completed, and cancelled orders.
_Avoid_: Flat history, customer list, generic recent orders

**Merchant Payment Account**:
The merchant-level payment account connected to BlitzPay so the merchant can accept supported payment methods and receive settlement.
_Avoid_: Branch account, checkout screen, shopper wallet

**Stripe Connect Onboarding**:
The hosted Stripe Connect flow a Merchant User starts from the merchant app to connect or complete the Merchant Payment Account setup, then return to BlitzPay Merchant.
_Avoid_: Shopper card entry, merchant signup, native in-app onboarding form

**Shopper Identity Withholding**:
The privacy rule that the merchant portal UI must not expose shopper personal identity anywhere in the merchant app.
_Avoid_: Customer name display, shopper profile visibility, identity lookup from orders

## Relationships

- A **Merchant User** has zero or more **Branch Memberships**
- A **Branch Membership** authorizes access to exactly one **Merchant Branch**
- A **Branch Group** encodes exactly one **Branch Membership**
- A **Merchant Action Queue** belongs to exactly one **Merchant Branch**
- A **Merchant Action Queue** prioritises orders needing merchant action over reference/history states
- A **Merchant Payment Account** belongs to one merchant, not to a **Merchant Branch**
- A **Merchant User** may start **Stripe Connect Onboarding** for the merchant they are authorized to operate
- **Stripe Connect Onboarding** configures exactly one **Merchant Payment Account**
- **Shopper Identity Withholding** applies across the entire merchant portal UI within one **Merchant Branch**
- An **Appearance** belongs to exactly one **Merchant Branch**
- A Merchant is either mobile or fixed; its **Merchant Branches** cannot mix classifications
- Only a **Mobile Merchant** may have **Appearances**
- Only a **Merchant Manager** may view, create, or cancel **Appearances**
- **Appearance History** contains completed or cancelled **Appearances**, not individual location movements

## Example dialogue

> **Dev:** "If a Merchant User is standing near Branch B but only has a Branch Group for Branch A, which orders can they open?"
> **Domain expert:** "Only Branch A. Branch Membership authorizes access; proximity is irrelevant."
