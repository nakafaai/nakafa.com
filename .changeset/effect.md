---
"www": patch
"@nakafa/cli": patch
"@repo/analytics": patch
"@repo/backend": patch
"@repo/contents": patch
"@repo/design-system": patch
"@repo/email": patch
"@repo/internationalization": patch
"@repo/math": patch
"@repo/typescript-config": patch
---

Run on Effect 4.0.0-rc.118 and Confect 10.0.0-next.25. Effect's HTTP, process,
and CLI modules now load from their public paths, and the renamed Schema checks
keep the same validation. Convex now records backend Effect logs as structured
entries at their own severity, so warnings and errors no longer arrive as plain
log lines. Nina's geometry tool still tells the model which characters a
coordinate may use. Signed content now reads through
@nakafa/aksara-contracts 0.43.0, the same contract code released for Effect
rc.118.
