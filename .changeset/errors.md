---
"www": patch
"@repo/internationalization": patch
"@repo/design-system": minor
"@repo/mascot": patch
---

Give every full-page state one arrangement with Nina in it. A page that cannot
be found has her searching, with a letter and a paper plane beside her. A page
that broke has her at her keyboard with a coffee and a light bulb. Each says
one sentence in the learner's language, without blame, and offers two ways on:
back home and search the materials when a page is missing, and try again and
back home when something broke. The pages no longer show a status code in type, a stack trace,
or a link to GitHub; the error is reported by the page itself, as before. Her
place has its final height before she is drawn, so nothing moves when she
arrives, and when she cannot be drawn the words and both ways on stay.

The page for an address that no page owns and the page that replaces the root
layout read a small dictionary of their own, `dictionaries/standalone`, instead
of the three whole dictionaries. `loadLocaleMessages` joins those words to the
app's, so every other page reads them as before.

"Try again" loads the document again. The framework's `retry` renders the
broken part again in the same document, where a part whose code failed to load
stays failed, so the page often did not come back.

The design system now answers how tall a picture is at a width
(`pictureHeight`) and how tall Nina is when she is whole (`wholeHeight`), so a
page can reserve her place without loading her. Her two windows moved to
`@repo/mascot/nina/box` for that.
