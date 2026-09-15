---
"@repo/design-system": minor
"www": patch
---

Render the product in Inter and give every rendered content heading a scannable
section rule. Inter replaces Geist Sans as the interface and reading face, the
serif reading title becomes Inter, the lesson and article title and summary move
to the start of the reading column at the larger display size, and lesson pages
drop the summary under the title while articles keep theirs.

Markdown and MDX headings keep the page ink and carry the theme `primary` accent
on the underline only, at Tailwind's own `decoration-2` and `underline-offset-4`
values. The accent stays at full strength because a softened rule falls to 1.69
contrast against the page in the matcha profile, while the theme contract
already validates `primary` as a mark on the page and card surfaces, so all 31
concrete themes stay visible without per-theme tuning.
