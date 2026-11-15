---
"@repo/backend": patch
---

Write one spend escrow at a time per action, so an action's parallel AI calls, such as the four embedding requests of a lesson build, no longer retry against each other on their payer's spend row.
