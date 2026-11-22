---
"@repo/design-system": patch
---

Keep the focus inside a dialog, a drawer and a modal sheet in Safari. Safari's
tab order skips buttons, so a Tab from the last field of a dialog left it and
dropped the focus on the page, which UI SDK's trap did not catch
(vercel-labs/ui#1018). The dialog now takes the focus back, and the next Tab
enters it at its first stop.
