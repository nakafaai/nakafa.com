---
"@repo/backend": patch
---

Billing uses Polar's SDK 1.0 on API version 2026-10 with a 30 second request timeout. A signed Polar webhook whose event type Nakafa does not handle is acknowledged with 202 without decoding its data. A customer deletion webhook needs only the customer id.
