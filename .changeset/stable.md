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
"@repo/next-config": patch
"@repo/seo": patch
"@repo/utilities": patch
---

Run on the first stable releases of Effect 4 (4.0.1) and Confect 10 (10.0.0).
Backend functions now read Confect's query, mutation, and action runners as
`runQuery`, `runMutation`, and `runAction` methods, the shape Confect 10 ships.
Signed content reads through @nakafa/aksara-contracts 0.46.0, the same contract
code released for the stable Effect peer.
