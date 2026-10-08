---
"www": patch
"@repo/backend": patch
"@repo/contents": patch
"@repo/design-system": patch
"@repo/math": patch
"@repo/typescript-config": patch
---

The typecheck now rejects three patterns the Effect language service can see
with full type information: `Schema.Schema.Type<typeof X>` (write
`typeof X.Type`), `instanceof` against a Schema class (use `Schema.is(X)`), and
classes that extend the native `Error`. Every existing use is rewritten, so
editors flag a new one as it is typed. The sitemap page error now lives beside
the sitemap page identity, which lets the route test use the real class.
