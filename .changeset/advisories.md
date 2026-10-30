---
"www": patch
"@repo/backend": patch
"@repo/email": patch
---

Move seroval to 1.6.12, which fixes GHSA-9wx9-5pv9-3349 and GHSA-f86p-h4j2-7qgj,
for the web app and for TanStack Start through one override, and @react-email/render to 2.2.0, whose html-to-text 10 no longer depends on
deepmerge. The better-auth advisories reach plugins the backend does not enable,
and their fix needs better-auth 1.7, which the Convex adapter cannot bundle yet,
so `osv.toml` records each one for 14 days.
