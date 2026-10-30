---
"www": patch
"@repo/analytics": patch
"@repo/backend": patch
"@repo/design-system": patch
"@repo/editor": patch
---

Dependencies move to their latest releases. Confect moves to 10.4.1, and the
backend reads untrusted document IDs through Confect's `DocumentIds` service.
Tiptap moves to 3.32.1 with one ProseMirror transform for the editors and the
server, and the Memory editor keeps writing underlines as `++words++`, which
3.32.1 would write as `<u>words</u>`. The PostHog Convex component shares the analytics package's posthog-node
release, which no longer imports the OpenTelemetry API. The Effect cohort stays
on 4.0.5 until a contracts release built on Effect 4.1 is adopted.
