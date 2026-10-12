---
"@repo/design-system": patch
---

Check Mermaid chart text before it renders. When Mermaid rejects the text, the
diagram box shows a short note and the chart source, not a red error box, and
error tracking gets no report. Other render failures show the same note and
are still reported.
