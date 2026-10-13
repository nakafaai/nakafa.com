---
"@repo/backend": patch
---

The AI gateway module no longer loads a Buffer polyfill, and the `buffer`
package leaves the backend's dependencies. Every model call goes through the
Convex gateway's chat adapter, which encodes the bytes of a file with `btoa`.
The two reads of the global `Buffer` in the AI SDK packages that have no guard
sit in the file encoders of the Vercel gateway client, one for a language model
and one for its batch client, and no call reaches that client. A test sends a
document and an image with the global removed.
