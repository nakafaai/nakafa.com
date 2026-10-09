---
"www": patch
"@repo/design-system": patch
---

The dithering artwork on the sign-in, auth error, and onboarding pages now
mounts only where it can be seen: on wide screens, in a browser with a
hardware WebGL2 context. Phones and narrow windows no longer create a WebGL
context for it. A wide-screen browser without WebGL2 used to show a blank area
and an unhandled error. Now the page keeps its plain background there, and a
failed load of the artwork no longer replaces the page.

Visitors who prefer reduced motion see a still picture. The canvas uses the
same pixel budget as the hero artwork, so large screens draw fewer pixels. The
shader's code now loads on demand instead of with the first JavaScript of these
pages.
