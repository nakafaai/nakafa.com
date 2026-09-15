---
"@repo/design-system": minor
"www": patch
---

Give rendered content headings one scannable accent ink and left-align the
reading title. Every Markdown and MDX heading now renders in the theme `primary`
token with a matching underline that scales with the heading size, while the
lesson and article title and summary move from centered to the start of the
reading column so they share the left edge of the body text, and the title
returns to its larger display size. The ink and the marker come from one already
contrast-validated token, so all 31 concrete themes stay readable without
per-theme tuning.
