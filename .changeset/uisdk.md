---
"www": minor
"@repo/design-system": minor
"@repo/internationalization": patch
---

The design system moves to UI SDK (`@ui-sdk/react` and `@ui-sdk/core` 0.1.0-beta.13) as its one primitive layer (ADR 0049).

- `@repo/design-system`: every dialog, menu, select, picker, command list, popover, tooltip, toast, calendar, date picker, resizable group, slider, tabs, accordion and navigation menu is a UI SDK part. On a phone, a dialog, a menu, a select and a picker rise from the bottom as a sheet in the same tree, with one grip and one sheet look. Base UI, sonner, react-day-picker, react-resizable-panels, react-textarea-autosize, frimousse and tw-animate-css leave.
- `www`: menu, command and picker rows run their action from `onSelect`, so a pointer, the keys and an agent reach it alike. A browser that hosts an agent (WebMCP) reads and uses the page's controls by name through `AgentBridge`, and is told to ask the reader before a destructive action that a dialog confirms.
- `@repo/internationalization`: the calendar's and the date picker's controls and a command list's result count read the dictionary.
