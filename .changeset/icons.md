---
"@repo/contents": minor
"@repo/design-system": minor
"www": patch
---

Give every tile of a list its own icon and its own colour. No icon is the icon
of two keys any more: each subject, exam, try-out subject, and navigation key
draws one of its own, and a key that the app does not know yet takes one of
twelve spare icons by its key instead of the one light bulb that every unknown
key shared. A lesson takes its icon from the family of its subject, ten or so
icons that all read as that subject, so a learner of mathematics sees pi,
sigma, a function, a compass, and a matrix instead of a column of pi.

A list takes its tiles apart: `getTileLooks` starts each row from the icon and
the hue its own key gives, and moves a row whose icon is held by an earlier row
to the next free icon of its pool, and a row whose blend is within 36 degrees
of an earlier one to the next free hue. A key keeps its look from visit to
visit when it has room. The home lessons, the curriculum cards, the try-out
countries, exams, tracks, and sections, the exam selector, and the subjects of
the landing page use it.
