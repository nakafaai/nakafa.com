---
"@repo/design-system": patch
---

Keep a Mermaid diagram's card one size from its first frame, so an answer or
lesson never moves or disappears around a diagram. The preview has a fixed
height and scales the diagram to fit, the placeholder shown while the card's
code loads shares its frame, and the dialog shows the diagram at full width.
Copying and downloading no longer load the syntax highlighter, and a
downloaded diagram is saved as a `.mmd` file.
