---
"@repo/design-system": patch
---

Move UI SDK to 0.1.0-beta.14. A popup's exit no longer waits on the scroll-tied
animations a sheet carries, so a sheet that a swipe closed leaves at once in
Firefox without the design system cancelling those animations itself, and the
grip of every sheet and the drawer's handle no longer carry a ref for it.
