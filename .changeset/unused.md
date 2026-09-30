---
"@repo/design-system": patch
---

Remove fourteen components that nothing renders: the alert dialog, aspect
ratio, block art, carousel, context menu, drawer menu, input OTP, menubar,
navigation menu, pagination, progress, switch, and toggle primitives, and the
superseded server markdown code renderer. The carousel and input OTP were the
only users of `embla-carousel-react` and `input-otp`, so both dependencies go
with them.
