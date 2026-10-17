---
"@repo/backend": patch
"www": patch
"@repo/contents": patch
"@repo/internationalization": patch
---

Keep what a Nina turn reads and writes small: loaded rows are written whole, a
chat's turns are a query of their own so a write to the running turn reruns
neither it nor the message page, a run reads what it needs before the model in
one query, a turn keeps what its history cost, and every page and text a caller
controls is bounded.
