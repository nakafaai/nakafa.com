---
"www": patch
"@repo/backend": patch
"@repo/contents": patch
"@repo/design-system": patch
"@repo/seo": patch
---

Read arrays and records through Effect's `Array` and `Record` modules. Every
`Array.isArray` and every `Object.keys`, `values`, `entries`, and
`fromEntries` call now goes through `Array.isArray` and `Record.keys`,
`values`, `toEntries`, and `fromEntries` from `effect`, and the repository
check rejects the native forms from here on. The check now resolves what each
name is bound to, so a module that imports or declares its own `Array` or
`Object` is left alone.
