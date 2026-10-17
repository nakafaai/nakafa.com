---
"@repo/backend": patch
"www": patch
---

Admit every try-out answer and section finish through one live-attempt gate in
`confect/assessment/gate`. Both writes go through the same checks of the
learner, the attempt, the section, and their deadlines, and a refused write
changes nothing. Answering another learner's question reports a missing
question, exactly like a question that does not exist, so a guessed ID reveals
nothing. Each answer now carries a version that grows with every write of its
question, and a cleared answer keeps its version. The server refuses an answer
whose version is not newer than the latest write of its question, and the page
then shows the server's answer again. A tab opened before versions must
reload: its answers carry no version, and the server refuses them. Saving an
answer writes its rows back as loaded, which skips the second read of each row
that a partial update made.
