---
"www": patch
---

The production build runs as two processes: `next build` in compile mode, then in generate mode. The compiler's memory is released before the pages are generated, so the two no longer add up to the memory limit of the build container. The build output is the same.
