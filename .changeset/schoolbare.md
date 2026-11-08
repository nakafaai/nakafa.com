---
"www": patch
"@repo/internationalization": patch
---

Open every address typed without a locale, nakafa.com/school and /school/pricing included, in the visitor's locale: the language cookie, then the browser's languages among Indonesian, English and German, else Indonesian. The rules of an address's locale live in one module, `lib/routing/locale`.
