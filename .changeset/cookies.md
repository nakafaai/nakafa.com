---
"www": patch
"@repo/backend": patch
---

Keep a staging or local sign-in when production's session is in the browser.
Production names its session cookie for nakafa.com, so the browser also sends it
to staging.nakafa.com and the local development host, ahead of their own cookie
of the same name, and they read no session. Every site that production's cookie
reaches, production itself aside, now names its Better Auth cookies `nakafa-dev`.
