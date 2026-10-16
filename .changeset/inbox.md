---
"@repo/backend": minor
---

Every invitation sent from this release on also waits in the inbox. Each invitation writes one inbox row for the invited Person, which the account sees once it claims that Person. A resend refreshes that row and marks it unread again, and revoking the invitation deletes it. A row is also deleted when its Person is released or removed, and a minute sweep finishes any run that did not happen.
