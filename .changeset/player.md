---
"www": patch
"@repo/design-system": minor
"@repo/internationalization": patch
---

Run every try-out section in one player. The header stays one row, with a back
link, the title, the timer, and Finish. A learner reads the questions as a list
or one at a time, and moves between them with a numbered navigator, a sidebar
from the large breakpoint and a sheet below it, that fills the answered
questions and rings the current one. Left and Right move between questions and
1 to 5 pick an option of a single-choice question. G opens and closes the
sheet, and from the large breakpoint it moves focus into the sidebar and back
to the question. Confirming a finish lists the questions still open, and a
number there leads back to one.

The server resolves the view before it sends the page, so the first render
already has it: a `view` parameter wins, and an unknown value is a 404, then the
view the learner saved in a cookie, then the list. The page shows a chosen view
at once and takes it back, with a toast, when the cookie cannot be saved.
Finishing keeps the running questions on screen until the page that follows has
rendered, so the finished section no longer flashes in between.

The design system gains the shadcn `Kbd` part, and `ResponsiveDialog` accepts
where focus goes when it closes and a callback after it has finished closing.
The animated timer digits moved from the try-out runtime to the player, which
the try-out summary reads as well.
