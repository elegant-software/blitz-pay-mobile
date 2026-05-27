# Auth

This context covers the authentication language shared by the shopper and merchant apps. It exists to keep biometric and session concepts precise across both products.

## Language

**Biometric Enrollment**:
The user's explicit opt-in to biometric login, stored as a device-local flag. Grants the biometric login button on the login screen.
_Avoid_: Biometric registration, biometric setup, face ID activation

**Biometric Unenrollment**:
The user's explicit opt-out of biometric login, removing the stored enrollment flag. The biometric login button disappears on next render.
_Avoid_: Biometric removal, face ID deactivation

**Biometric Prompt**:
The one-time bottom sheet shown immediately after a successful password login when the device supports biometrics and the user has not yet enrolled. Offers "Enable" or "Not now".
_Avoid_: Biometric nudge, biometric onboarding, biometric alert

**Biometric Prompt Dismissal**:
The user declining the Biometric Prompt, recorded as a device-local flag so the prompt is never shown again regardless of future password logins.
_Avoid_: Biometric cancel, prompt skip

## Relationships

- A user may have **Biometric Enrollment** only after a successful password login or after enabling the Account settings toggle
- **Biometric Prompt** is shown at most once per app install: after the first successful password login where the device supports biometrics and **Biometric Enrollment** is absent
- **Biometric Prompt Dismissal** does not prevent the user from enrolling via the Account settings toggle later
- **Biometric Unenrollment** via the Account settings toggle does not reset **Biometric Prompt Dismissal** — the prompt does not reappear
