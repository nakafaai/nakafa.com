---
"@repo/analytics": patch
"www": patch
---

Classify the traffic behind server exceptions. Server captures carried no user agent, so PostHog filed every one under automated traffic and hid real visitor faults during triage. `captureServerException` now accepts the requesting user agent and sends it as `$raw_user_agent`. The request-scoped capture seam reads the user agent once through `next/headers`, so every route handler, metadata, and scheduled capture classifies without extra plumbing; the Next.js request-error hook and the chat stream error reporter pass the user agent from their own request headers. The redacted exception payload stays unchanged.
