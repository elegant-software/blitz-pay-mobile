# AGENTS.md

Operating manual for AI coding agents (Claude Code, Codex, etc.) working in this repo. Read this **and** `CONSTITUTION.md` before modifying code. `CONSTITUTION.md` is the binding source of truth for repo rules. `CLAUDE.md` has the architectural tour; this file is about how to behave.

## Required Reading Order
1. `CONSTITUTION.md` — binding rules and the source of truth for observability, security, native config, i18n, architecture pattern, and linked business references.
2. `docs/references/business-guidelines.md` — merchant/branch business rules and app-targeting expectations.
3. `docs/architecture.md` — canonical Feature-Based + MVVM + Controlled State Management pattern; folder structure and layer rules.
4. `CLAUDE.md` — commands, screen inventory, auth flow, env vars.
5. `specs/` — the active feature spec if the task references an issue number.

## Ground Rules

- **Don't push, don't open PRs, don't merge.** Wait for explicit user instruction.
- **Don't run destructive git.** No `reset --hard`, `push --force`, `branch -D`, `checkout .` without explicit ask.
- **Don't add features beyond the task.** Bug fixes don't get surrounding cleanup. No speculative abstractions.
- **Default to no comments.** Only comment non-obvious *why*. Never narrate *what* the code does.
- **No new `.md` files** unless the user asks. `CONSTITUTION.md`, `AGENTS.md`, and `CLAUDE.md` are the exception because they were explicitly requested.
- **Target the correct app by default.** Merchant-facing requests go in `blitz-pay-merchant/`. Consumer-facing requests go in `blitz-pay/`. If the request does not make the target app obvious, ask before editing.

## Payment / TrueLayer Work — Special Rules

When touching `mobile/src/lib/truelayer.ts`, `mobile/src/screens/CheckoutScreen.tsx`, or anything under a `specs/*truelayer*` / `specs/*payment*` folder:

1. **Instrument before you refactor.** If the file has fewer observability calls than Constitution §I requires, add them in the same PR.
2. **Log provider reasons verbatim.** `result.reason`, HTTP response bodies, Keycloak `error_description` — all go to `observability.error`/`warn` before being mapped to a user-facing i18n key.
3. **Never log PII.** No full tokens, no PAN/CVV, no raw IBAN. Mask to last-4 or hash.
4. **Sandbox vs Production** is switched via `EXPO_PUBLIC_TRUELAYER_ENVIRONMENT` only — never inline.
5. **Redirect URI mismatches** are the #1 cause of "payment not possible". On any TrueLayer SDK failure, log the expected redirect URI alongside the provider reason.

## Native Android / iOS Changes

- Edit via `mobile/plugins/with*Config.js` or `mobile/app.json`. Generated `android/`/`ios/` folders are disposable.
- If you hotfix the generated folder, mirror the change back into the plugin in the same commit.
- SDK-driven version bumps (e.g. `desugar_jdk_libs`, `compileSdkVersion`, `minSdkVersion`, `ios.deploymentTarget`) — cite the upstream SDK release note or error message in the commit body.

## i18n

- Every new UI string lands in **both** `de` and `en` of the relevant `translations.ts`.
- Default language is German. No inline English in JSX.

## Tooling Conventions

- Use dedicated tools (Read/Edit/Write/Glob/Grep) over shelling out to `cat`/`grep`/`find`.
- Prefer `Edit` over `Write` for existing files.
- Run background shell commands (`run_in_background: true`) for long-lived processes (Expo dev server, builds). Foreground short commands only.
- Parallelize independent tool calls in a single message.

## Definition of Done

A task is **not** done until:
- [ ] Code compiles (`npm run lint` in the relevant package).
- [ ] New money-path code has the three observability touchpoints from Constitution §I.
- [ ] Any new env var is documented in the relevant `.env.example` and in `CLAUDE.md`.
- [ ] i18n keys are present in both `de` and `en`.
- [ ] For UI changes, the agent has exercised the feature in a simulator/browser, or explicitly stated it could not.
- [ ] No secrets in the diff, no PII in logs.

## When In Doubt

Ask the user. Pausing to confirm costs a message; an unwanted destructive action costs work. Risky actions (destructive git, pushing, opening PRs, uploading to third parties, modifying shared CI) always require explicit authorization — prior approval does not generalize.

## Active Technologies
- TypeScript 5.3, React 19.2, React Native 0.83.4, Expo SDK 55 + React Navigation 6, Expo Location, Expo Task Manager, Expo Secure Store, existing TrueLayer/Stripe/Braintree payment integrations (008-nearby-merchant-checkout)
- Expo Secure Store for auth/session state; controlled in-memory feature state for discovery, catalog, and baske (008-nearby-merchant-checkout)
- TypeScript 5.3, React 19.2, React Native 0.83.6, Expo SDK 55 + React Navigation 6, Expo Location, Expo Secure Store, existing `fetchMerchantCommerceJson` API wrapper, existing `merchant-catalog` and `basket` feature modules (010-nearby-merchant-product-management)
- Expo Secure Store for auth/session state; controlled in-memory feature state for merchant branch context, product drafts, and basket state (010-nearby-merchant-product-management)

## Recent Changes
- 008-nearby-merchant-checkout: Added TypeScript 5.3, React 19.2, React Native 0.83.4, Expo SDK 55 + React Navigation 6, Expo Location, Expo Task Manager, Expo Secure Store, existing TrueLayer/Stripe/Braintree payment integrations
