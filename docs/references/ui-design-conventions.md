# UI Design Conventions

## Keyboard Avoidance

Every screen that contains a `TextInput` must ensure the keyboard never obscures the active field or action controls.

### Required pattern

Wrap the screen's root element with `KeyboardAvoidingView` and place a `ScrollView` (with `keyboardShouldPersistTaps="handled"`) inside it:

```tsx
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

<KeyboardAvoidingView
  style={{ flex: 1 }}
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
>
  <ScrollView keyboardShouldPersistTaps="handled">
    {/* form fields */}
  </ScrollView>
</KeyboardAvoidingView>
```

### Rules

- Use `behavior="padding"` on iOS and `behavior="height"` on Android. Never leave Android behavior as `undefined`.
- Always add `keyboardShouldPersistTaps="handled"` to any `ScrollView` that contains or is a sibling of a `TextInput`, so tapping a button while the keyboard is open does not first dismiss the keyboard instead of firing the action.
- If the screen has a fixed bottom action bar (positioned below the `ScrollView` in the flex column), wrap the entire screen — including that bar — with `KeyboardAvoidingView` so the bar floats above the keyboard.
- Screens where the only `TextInput` is in a pinned header (e.g. a search bar at the very top) still benefit from `KeyboardAvoidingView` because the list content below must remain scrollable above the keyboard.

### Screens that apply this pattern (both apps)

| App | Screen | Notes |
|-----|--------|-------|
| merchant | `LoginScreen` | email + password |
| merchant | `ProductEditScreen` | multi-field product form |
| merchant | `AppearancesScreen` | appearance creation form with lat/lng fields |
| merchant | `OrdersScreen` | search bar in header |
| consumer | `LoginScreen` | email + password |
| consumer | `SignupScreen` | registration form |
| consumer | `SendInvoiceScreen` | multi-step form with fixed bottom CTA bar |
