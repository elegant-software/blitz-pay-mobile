# Context Map

## Contexts

- [Order Payment](./CONTEXT.md) — defines the shared order and payment language used by both the shopper and merchant apps
- [Merchant Portal](./blitz-pay-merchant/CONTEXT.md) — defines branch-scoped merchant access language in the merchant app
- [Auth](./docs/auth/CONTEXT.md) — defines biometric enrollment and session language shared by both apps

## Relationships

- **Order Payment ↔ Merchant Portal**: A **Merchant User** may view and, for an **Editable Unpaid Order**, change a shared **Order** before payment starts
