---
"@repo/backend": patch
---

Ask the gateway for zero retention on every embedding request, as a decision
already does: the embedding model is built with `zdr: true`, the one retention
flag the provider's embedding options hold.
