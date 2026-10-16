---
"@repo/backend": minor
---

Every invitation now also waits in the inbox. Each invite and each resend writes one inbox row for the invited Person, which the account sees once it claims that Person. A row is deleted when its Person is released or removed, and a minute sweep finishes any run that did not happen.
