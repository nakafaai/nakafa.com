---
"www": patch
"@repo/backend": patch
---

Serve staging on its own host. `staging` is a label that no school may take, so
the proxy sent every page of staging.nakafa.com to nakafa.com. The deployment's
own host is now its main site and never moves; every other refused host still
moves to nakafa.com.

Sign in and pay on staging. Staging shares the dev deployment with local
development, and Better Auth knew only the local site, so it refused staging's
Google sign-in. A deployment that sets `STAGING_SITE_URL` now answers each site
on its own host, with its own callback URL and cookie domain, and a checkout may
return to either site.
