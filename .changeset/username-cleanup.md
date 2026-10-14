---
"@repo/backend": patch
---

Delete the migration that gave the accounts made before usernames existed their
username, now that it ran on dev and production and a dry pass finds none
waiting.
