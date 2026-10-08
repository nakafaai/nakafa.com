---
"@repo/backend": patch
---

Billing now uses Polar's SDK 1.0 on the 2026-04 API, with every Polar request sent to the environment the deployment selects and given up after 30 seconds. A correctly signed Polar webhook now gets an empty 202 instead of a 400 when its event type is a string Nakafa does not handle, and a 202 instead of a 400 when a create, update, or subscription event carries a field Nakafa does not read with a value the previous SDK rejected, so Polar stops retrying events Nakafa never uses; a missing or mistyped field Nakafa reads still gets a 400, a body that is not JSON still gets a 500, a deletion still checks the whole customer, and every other webhook answer is unchanged.
