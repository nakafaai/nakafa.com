---
"www": patch
---

Ship the logo with the image routes again. The routes read it through Effect's FileSystem since the Node built-ins change, which the file tracer cannot follow, so the deployed function answered 500. The build configuration now names the file, and a browser test checks the route and its trace.
