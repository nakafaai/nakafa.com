---
"@repo/design-system": patch
"www": patch
---

Show a diagram at its natural size when its dialog opens. The dialog used to
scale a large diagram down to its width, which made the labels of a diagram
with many nodes hard to read. Now the dialog draws the diagram at the size
Mermaid lays it out, so each label keeps its own font size. A diagram wider
than the dialog scrolls in both directions, and a smaller one sits in the
middle. The card still shows the whole diagram.
