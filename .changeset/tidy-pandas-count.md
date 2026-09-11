---
"@repo/analytics": patch
"www": patch
---

Restore always-on anonymous visitor counting with a GDPR-safe two-tier browser client. The PostHog client now initializes for every visitor in cookieless `on_reject` mode with automatic history-based pageviews, so undecided, declined, and DNT/GPC visitors are counted through the server-side hash without any browser storage. Explicit consent upgrades the same client to full capture with stable identity, and the identity gate admits anonymous events in every state while still restricting identified events to the resolved user. Baseline events minimize URLs to origin plus pathname and drop referrer URLs.
