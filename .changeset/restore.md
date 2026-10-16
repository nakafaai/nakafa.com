---
"@repo/backend": patch
"www": patch
---

Give a deleted memory back exactly as it was when the learner presses Undo.
The server keeps what it deleted, sealed as stored, for the length of the Undo
in a restore record, and the new `restore` function puts it back with its kind,
end day, author, confirmation time, words, title and index keys. A situation
therefore keeps its end day, and a memory Nina saved keeps Nina as its author,
where the old Undo wrote the words back as a memory the learner wrote, with no
end. A scheduled job deletes the record when the window ends, and account
deletion deletes it with the learner's memories. The Memory page asks the
server to restore the memory and shows the row again at once, in its place,
and its toast closes when the window ends. When the server cannot put the
memory back, the page says that the Undo failed.
