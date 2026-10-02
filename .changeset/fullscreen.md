---
"@repo/design-system": minor
"@repo/internationalization": patch
"www": minor
---

Show every lesson lab, chart, animation, and 3D scene full screen. Each visual
now renders through one `VisualCard`, whose bordered footer holds the visual's
own controls, such as a 3D scene's grid and rotation, beside a full screen
button. Desktop, Android, and iPad use the Fullscreen API on the card itself.
iPhone Safari has no element full screen, so there the same card covers the
viewport in the browser's top layer, above every bar of the page. Where
scrollbars take room, such as on Windows and Linux, the card still reaches
every edge of the screen while the page behind keeps its layout. The scene
never remounts: a 3D scene keeps its camera, and a canvas or chart redraws at
the larger size and returns to its own size afterwards.

While a card fills the screen, the page behind stays still and inert and its
3D scenes stop drawing. Escape or the button returns the card to its place,
focus returns to the button, and a status message tells screen readers the
visual is full screen. A 3D canvas also follows its frame when the frame
shrinks, such as a phone turned to a narrower width. The bacterial growth
controls now name their play, pause, and reset buttons in the learner's
language, and put a space between each time and its unit, as in "30 minutes".
