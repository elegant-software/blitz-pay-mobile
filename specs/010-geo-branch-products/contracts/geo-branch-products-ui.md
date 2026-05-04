# UI Contract: Geo Branch Products

This contract defines the mobile operator-facing behavior for nearby-merchant branch product management inside `blitz-pay`.

## Entry Point

- The workflow starts from the existing nearby-merchant product path in the mobile app.
- The product-management experience is only available after a nearby merchant is resolved from device location context.
- The active branch name is the primary visible label; merchant name is secondary context.

## Branch Resolution

Inputs:

- Current device location when available
- Last-known device location when current resolution is unavailable
- Merchant context selected from the nearby-merchant flow

Behavior:

- The app resolves one active branch for the merchant before showing editable product controls.
- If multiple active branches exist, the nearest valid branch is chosen for the working session.
- If no branch can be resolved, the page shows a blocked or empty state and does not expose add or update actions.

## Product List

Displayed state:

- Active branch name
- Merchant name
- Branch product rows scoped to the resolved branch only
- Product name
- Product price
- Optional category, product code, description, and imagery when available

Behavior:

- Only products for the resolved branch are shown.
- Empty product state still preserves merchant and branch context.
- Product imagery failures fall back gracefully without inventing placeholder business data.

## Product Detail And Edit

View behavior:

- Selecting a product opens a branch-scoped detail or edit experience.
- Existing values are prefilled from the current branch product.
- The app makes clear which merchant branch the product belongs to during editing.

Update behavior:

- Editable fields include product name, price, description, and image input.
- Saving with invalid required input is blocked with field-level validation feedback.
- Save failure preserves the entered draft for retry.
- If the branch context or product version becomes stale, save is blocked with a refresh-required message.

## Product Create

Entry behavior:

- The add-product action is available only when a valid active branch context exists.
- New products are created under the resolved branch by default.

Create behavior:

- Required inputs: product name and price
- Optional inputs: description and image
- Successful creation refreshes the branch product list in the same session
- Failed creation preserves the draft and surfaces corrective feedback

## Cross-Cutting States

- Loading state for branch resolution
- Loading state for branch product refresh
- Empty state when no nearby branch is available
- Empty state when branch has no products
- Validation state for required product fields
- Recoverable failure state for create/update calls
- Stale-context state when branch or product data changes mid-edit

## Observability Expectations

- Branch resolution logs request, failure, and result boundaries.
- Product create/update logs request, failure, and result boundaries.
- Logs include merchant and branch identifiers needed for support, but never secrets, tokens, or PII.
