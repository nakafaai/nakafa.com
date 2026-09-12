---
"@repo/analytics": patch
---

Keep the original error name and a bounded error code beside every redacted operational exception. Error tracking now groups faults by type instead of collapsing each one under a single "OperationalError" name, while the message stays redacted.
