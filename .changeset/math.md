---
"@repo/design-system": patch
"www": patch
---

Keep lesson and chat text still while math renders. Math blocks render with
the page instead of skipping layout off screen, whose placeholder heights moved
the text around them, and every page preloads the KaTeX faces its server
rendered formulas draw, including lessons Next generates on demand. The chat
loads the core math faces when it opens, so answers keep their lines when math
arrives.
