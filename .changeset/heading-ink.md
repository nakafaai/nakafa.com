---
"@repo/design-system": minor
"www": patch
---

Render the product in Inter and give every rendered content heading a scannable
section rule. Inter replaces Geist Sans as the interface and reading face, the
serif reading title becomes Inter, the lesson and article title and summary move
to the start of the reading column at the larger display size, and lesson pages
drop the summary under the title while articles keep theirs.

Markdown and MDX headings render their words in the theme `primary` accent and
draw the underline in the page ink, at Tailwind's own `decoration-2` and
`underline-offset-4` values. Both tokens already pass the theme contract as text
on the page and card surfaces, so all 31 concrete themes stay legible without
per-theme tuning.
