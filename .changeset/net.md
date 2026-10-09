---
"@repo/backend": patch
---

Research URLs that use IPv4-compatible IPv6 addresses (::/96), such as `https://[::8.8.8.8]/`, are now refused. A research host now needs every address it resolves to be public, so an address the parser does not understand also refuses the URL.
