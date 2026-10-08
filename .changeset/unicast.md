---
"@repo/backend": patch
---

A research URL with an IPv6 address is now allowed only when the address is inside the global unicast space (2000::/3) and outside its special-use blocks. Addresses in reserved space, such as `https://[::5efe:7f00:1]/`, are refused.
