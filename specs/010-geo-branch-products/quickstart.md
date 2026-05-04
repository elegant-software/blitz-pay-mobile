# Quickstart: Geo Branch Products

## Prerequisites

- Node.js/npm compatible with the existing Expo mobile app
- Dependencies installed in `blitz-pay/`
- Valid mobile auth setup or the existing auth bypass for local testing
- Access to a backend environment that returns nearby merchants, branches, and branch products
- Device or simulator with location services enabled

## Run The App

```bash
cd blitz-pay
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

1. Launch the `blitz-pay` app and sign in.
2. Open the nearby-merchant discovery flow and allow location access.
3. Select or enter a nearby merchant path that leads to branch product management.
4. Verify the app resolves one active branch and shows the branch name as the primary label.
5. Confirm the visible product list contains only products from that branch.
6. Open an existing product and verify the current product details are prefilled for the resolved branch.
7. Update the product name, price, description, or image and save.
8. Verify the product list refreshes and shows the saved branch product change.
9. Start a create-product flow for the same branch and submit valid required fields.
10. Confirm the new product appears in the same branch product list.
11. Retry with invalid required fields and confirm validation blocks the save without clearing the draft.
12. Simulate a stale branch or product state and confirm the app requires a refresh instead of silently saving.

## Verification Commands

```bash
cd blitz-pay
npm run lint
```

```bash
cd blitz-pay
npm test
```

## Notes

- This plan extends the existing nearby-merchant and merchant-catalog mobile flows rather than creating a new app surface.
- Product management is intentionally restricted to one resolved branch at a time.
- Any new user-facing strings must be added to both German and English translations during implementation.
