---
"@repo/analytics": patch
---

Name operational exceptions after their admitted origin so error tracking groups by call site instead of minified frames. `createOperationalException` derives `OperationalError(source)` (or `source.operation`) from the already-decoded properties; messages, causes, and payloads stay redacted and only developer-authored constants enter the name.
