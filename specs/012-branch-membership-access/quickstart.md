# Quickstart: Branch Membership Access

## Prerequisites

- Node.js/npm compatible with the existing Expo merchant app
- Dependencies installed in `blitz-pay-merchant/`
- Valid merchant auth setup or the existing auth bypass for local testing
- A backend environment reachable by the merchant app for orders and products
- Test credentials that cover these cases:
  - one valid branch membership
  - multiple valid branch memberships
  - zero valid branch memberships

## Run The App

```bash
cd blitz-pay-merchant
npm install
npm run start
```

Optional platform run:

```bash
npm run ios
```

```bash
npm run android
```

## Validate The Planned Feature

1. Launch `blitz-pay-merchant` and sign in with a user who has exactly one valid branch membership.
2. Open Orders and confirm the visible branch scope matches the authorized branch, not device proximity.
3. Open a nearby physical location that does not match the authorized branch and confirm Orders still uses the authorized branch.
4. Open Products and confirm the product list belongs only to the authorized branch.
5. Start product creation and confirm the submitted branch context matches the active authorized branch.
6. Open product edit and confirm the branch scope remains the same authorized branch through save.
7. Sign in with a user who has no valid branch memberships and confirm Orders and Products show a blocked branch-access state.
8. Sign in with a user who has multiple valid branch memberships and confirm the app uses one explicit active authorized branch at a time.
9. Simulate a session change that removes the active branch membership and confirm branch-scoped screens block further actions until branch scope is restored.
10. Confirm no new logs expose raw token values or full decoded claims.

## Verification Commands

```bash
cd blitz-pay-merchant
npm run lint
```

## Notes

- This plan corrects authorization for branch-scoped merchant workflows; it does not change consumer nearby-merchant behavior.
- Geolocation may still exist elsewhere in the merchant app, but not as the source of order or product access.
- New user-facing branch-access strings must be added to both German and English translations during implementation.
