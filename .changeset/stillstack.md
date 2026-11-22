---
"@repo/design-system": patch
"www": patch
---

Keep the sheet behind still when another sheet rises over it on a phone. A
drawer or menu sheet under a submenu, such as the sidebar under the account
menu, no longer shrinks and rises on every frame of the new sheet's rise, which
made Safari repaint both sheets each frame, so the text behind flickered and the
rise stuttered. The theme submenu on a phone now opens at its first theme
instead of scrolled to its end: it is drawn at the end of the page rather than
inside the account menu's sheet, whose focus reveal scrolled it
(vercel-labs/ui#1016). The page no longer writes its sign-in mark again with an
unchanged value while a drawer opens, which restyled the whole page, and a side
sheet no longer animates its width or blurs the page behind it on a touch screen.
