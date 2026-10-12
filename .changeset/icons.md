---
"@repo/contents": minor
"@repo/design-system": minor
"www": patch
---

Give every tile of a list its own icon and its own colour. No icon is the icon
of two keys any more: each subject, exam, try-out subject, navigation key, and
article category draws one of its own, and a key that the app does not know yet
takes one of twelve spare icons by its key instead of the one light bulb that
every unknown key shared. A lesson takes its icon from the family of its
subject, eight to twelve icons that all read as that subject, so a learner of
mathematics sees pi, sigma, a function, a compass, and a matrix instead of a
column of pi. The four language keys of the try-outs read as language (many
languages, a quill, reading glasses, a book with a magnifier) instead of two
landmarks, and the drawings that read alike (three globes, two chips, two
brains, calendars that differ by a mark) were told apart.

A list takes its tiles apart: `getTileLooks` starts each row from the icon and
the hue its own key gives, and moves a row whose icon is held by an earlier row
to the next free icon of its pool, and a row whose blend is within 36 degrees
of an earlier one to the next free hue. A key keeps its look from visit to
visit when it has room. A page that shows several lists passes the looks of the
lists before as `shown`, so the trending lessons of the home page never repeat
an icon of Continue learning while their family has a free one, and a hue that
has room from the shown tiles wins among the hues that have room in the list.
Two routes of one subject on a curriculum grid take two icons of the family of
that subject. The home lessons, the curriculum cards, the try-out countries,
exams, tracks, and sections, the exam selector, the article categories, and the
subjects of the landing page use it.

The icon of a curriculum stage has one owner, the navigation icons of the
curriculum, and the sidebar and the search palette read it from there, so the
rows of one group no longer all draw the icon of the group. `lib/tile` keeps the
blend of one tile and `lib/look` holds how a list or a page takes its tiles
apart.
