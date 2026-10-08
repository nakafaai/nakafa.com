---
"www": patch
"@repo/backend": patch
---

A signed-in visitor is no longer shown as signed out when the session token route fails: transient failures are retried on the shared schedule, an outage is reported as an error, and onboarding admission now has a ten second deadline.
