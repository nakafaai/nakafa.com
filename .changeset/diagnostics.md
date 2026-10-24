---
"@repo/analytics": patch
"@repo/design-system": patch
---

Report the class name of a failed Mermaid render, such as `TypeError`, as the `error_name` property. The message stays redacted. Only a plain identifier of 128 characters or fewer is kept, so the property cannot carry chart text or other user content.
