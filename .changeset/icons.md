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
subject, nine to twelve icons that all read as that subject, so a learner of
mathematics sees pi, sigma, a function, a compass, and a matrix instead of a
column of pi. Every pool of icons holds more icons than the longest list of
tiles that the corpus holds, which is eight: the classes 1 to 8 of the Merdeka
curriculum once they are published.

The drawings that read alike at 40px were told apart, so no two tiles that can
meet look like the same object: the three code icons of informatics and
computer science, the git graphs, the two mountains, the gavel in a frame and
the gavel, the flasks, the game controllers, the scatter and bubble charts,
the routers, the signatures, the pulses, the bolts, the three tall buildings,
the five calendars, and the three books and the student and the group of the
grades. The four language keys of the try-outs read as language and as
reading a text.

A list takes its tiles apart: `getTileLooks` starts each row from the icon and
the hue its own key gives, and moves a row whose icon is held by an earlier row
to the next free icon of its pool, and a row whose blend is within 36 degrees
of an earlier one to the next free hue. A key keeps its look from visit to
visit when it has room. A page that shows several lists passes the looks of the
lists before as `shown`, so the trending lessons of the home page never repeat
an icon of Continue learning while their family has a free one. Two routes of
one subject on a curriculum grid take two icons of the family of that subject.
A card that draws reviewed artwork instead of a tile comes back from
`getTileLooks` as its artwork, in its place, and takes no icon and no hue from
the tiles around it; `getTileShifts`, for a list whose tiles hold a flag
instead of an icon, does the same with an object that holds the artwork. The
home lessons, the curriculum cards, the try-out countries, exams, tracks, and
sections, the exam selector, the article categories, and the subjects of the
landing page use it.

The trending lessons of the home page no longer show their view count, and the
track cards of a try-out exam no longer show their set count.

The icon of a curriculum stage has one owner, the navigation icons of the
curriculum, and the sidebar and the search palette read it from there, so the
rows of one group no longer all draw the icon of the group. The sidebar takes
the icon of each article category on the server, so the spare icons and the
look module stay out of the JavaScript that every page loads. `lib/tile` keeps
the blend of one tile and `lib/look` holds how a list or a page takes its tiles
apart.
