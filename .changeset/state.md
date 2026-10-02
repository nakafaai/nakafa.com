---
"@repo/design-system": patch
"www": patch
---

Re-render only the parts of a page whose state changed. The outline tracks its
headings with one observer and redraws only the entries that become active or
inactive, the chat's controls and status rows stay still while Nina streams an
answer, and the forum viewport and 3D scene controls update only the parts that
read the changed value.
