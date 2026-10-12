---
"@repo/backend": patch
---

The AI gateway module no longer loads a Buffer polyfill, and the `buffer`
package leaves the backend's dependencies. Every model call goes through the
Convex gateway's chat adapter, which encodes the bytes of a file with `btoa`.
The one read of the global `Buffer` in the AI SDK packages that has no guard
sits in the Vercel gateway client, which no call reaches. A test sends a
document and an image with the global removed.
