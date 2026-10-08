---
"@repo/backend": patch
---

Billing uses Polar's SDK 1.0 on API version 2026-10 with a 30 second request timeout. A signed Polar webhook whose event type the SDK does not know is acknowledged with 202. A customer deletion webhook needs only the customer id.
