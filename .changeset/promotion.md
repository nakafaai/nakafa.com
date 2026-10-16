---
"@repo/backend": patch
---

Move a school's students up a grade and assign homeroom teachers. An Admin
prepares a promotion from one period to the next, the principal approves it, and
applying it archives the period, creates the new class groups, places the
students, and copies the homeroom teachers. Undo steps back one step at a time
until the new period opens. Every change is journaled.
