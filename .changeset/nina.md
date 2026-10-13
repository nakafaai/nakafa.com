---
"@repo/mascot": minor
"@repo/design-system": minor
"www": patch
---

Bring Nina, Nakafa's mascot, into the product, with the things of her world.
`@repo/mascot` now holds her as pure geometry: one figure computed from
numbers, 13 things she does, 3 she does over an edge, and 15 faces, and beside
her 32 flat things (a book, a pencil, a padlock, a medal, and so on), each with
one small motion of its own. The design system draws them: `Nina` whole, in a
round tile, or looking over an edge; `Thing`; `Toys`, `Toy`, and `Scatter` for
things a visitor can pick up and throw, which never leave their box; and
`Watch`, which turns the eyes of the animals toward the pointer.

A server draws Nina as a still picture with no script. Her life loads when she
nears the screen or a pointer comes to her, takes over from the picture without
a jump, and writes each frame straight onto her elements, so React does not
render her again while she moves. With reduced motion she holds one pose. If
her life cannot load she stays in that pose.

Her colours and the pop family are theme tokens that look the same in every
theme.
