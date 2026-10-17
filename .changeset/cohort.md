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
"@repo/mascot": patch
"@repo/next-config": patch
"@repo/seo": patch
"@repo/typescript-config": patch
"@repo/utilities": patch
---

Run on Effect 4.0.5 with the Effect compiler plugin 0.53.3. The UUID helper calls
Effect's `randomUUIDv4()`, which Effect 4.0.3 made a function. The backend reads
local runtime inode numbers as exact bigints. No change to what the application
does.
