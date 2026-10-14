---
"www": patch
---

The AI, content views, and search stores now update their state without immer, through Effect's Record and Array helpers. The web app no longer depends on the immer package.
