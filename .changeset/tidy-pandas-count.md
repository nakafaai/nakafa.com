---
"@repo/analytics": patch
"www": patch
---

Deepen the browser analytics gate into a single transition table with SDK-derived types and explicit pageviews. The gate module owns baseline, grant admission, and baseline revocation atomically, so callers can never opt in without authorizing identity. The hand-written PostHog client mirror is replaced with types picked from the installed SDK, and automatic pageviews give way to explicit initial-plus-history capture: each view lands exactly once, after identity is known, with no duplicate on consent transitions. Undecided, declined, and DNT visitors stay counted through cookieless baseline capture with minimized URLs.
