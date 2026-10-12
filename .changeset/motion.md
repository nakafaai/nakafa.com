---
"@repo/design-system": minor
"www": patch
---

Give every interface transition the same curves and durations, and make every
control answer a press. The design system defines two curves, ease-out for
anything that enters, leaves, or answers the learner and ease-in-out for a thing
that moves from one place to another, and three durations: press for the press
itself, ui for menus, popovers, tooltips, and colour changes, and surface for
dialogs, sheets, and the sidebar. A transition that names no curve or duration
takes ease-out and ui. Menus, popovers, the select list, tooltips, and the
accordion now open in 180ms, and dialogs and sheets in 240ms. No component
writes its own curve or duration for these any more, and no transition animates
every property: each names the ones that change. The drawer keeps the curve and
the time of its swipe, which belong to the gesture.

Buttons, toggles, tabs, switches, checkboxes, radios, sidebar rows, and the
close and clear buttons shrink to 0.96 for 120ms while pressed, instead of
shifting by a pixel, and stay still when the learner asks for reduced motion. A
control that opens a popup keeps its size, because the popup measures the
control once, when it opens. An answer choice in a try-out borrows the look of
a button and stays still.

The command palette appears and leaves at once: an action from the keyboard is
never animated.

Nina's answers step their headings down so the order of her thinking shows:
22px, 19px, and 17px for levels one to three, and the size of the answer from
level four, with more room above a heading than below it. The article card's
hover line now grows in 180ms instead of 500ms.
