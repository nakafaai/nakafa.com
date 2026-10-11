# ADR 0022: Nina Memory Is On For Everyone, Typed, Sealed, And Independent Of Chats

## Status

Accepted. Supersedes ADR 0010, which kept memory off until a learner turned it
on.

## Context

ADR 0010 kept memory opt-in because many learners are minors. Signing in is
acceptance of Nakafa's terms, and the privacy page names memory plainly in the
same release. A learner who turned memory off left no trace, because turning it
off deleted the only document, so no past choice can be honoured and everyone
starts on.

The old memory was one document per learner with an array of 30 untyped facts
of 160 characters. A learner could only forget a fact. Nothing expired, and the
fast model read every completed turn of a learner whose memory was on, whatever
the message said.

Memory is like a person's memory: it belongs to the learner, not to the
conversation in which it was said. A conversation that ends or is deleted takes
nothing from it.

## Decision

Memory is on for everyone. The learner reads, adds, edits and deletes memories,
pauses memory, and deletes all of it on one page, Settings, AI, Memory. Pausing
sets `ninaMemoryPaused` on the learner's learning preference and keeps every
row. While paused, Nina saves nothing and reads nothing. Resuming removes the
mark, so a learner who never paused has no mark.

A memory is one row. It holds a title, words, or both. The words are at most
2000 characters and may hold Markdown, whose formatting counts toward the limit;
they are empty when the memory is only a title. The title is optional and at
most 80 characters, and only the learner writes it: Nina never gives a memory a
title. A memory has an author of its words (`nina` or `learner`), the time it
was last confirmed, and the content identity of the lesson that was open when
Nina wrote it, which is the same in every language. The learner writes pure
text, so a memory written on the Memory page has no kind. A memory Nina wrote
has a kind (`level`, `goal`, `style`, `struggle` or `situation`), and a memory
the learner wrote takes one when a later chat says it again (step 4 below). A
`situation` is something with an end. Nina gives it `validUntil`, the end of its
last day, and drops a situation she cannot date, so a situation always has an
end day. What Nina writes is one sentence of at most 280 characters. A learner
keeps at most 100 memories. The words and the title are each sealed for their
learner with the vault, in the fields `ninaMemories.text` and
`ninaMemories.title`, so a value sealed for one field does not open as the
other. A row without its learner key is a defect. A row names no chat.

Memory is written only when the learner's own words support it, and plain code
decides. The model words each statement, and plain code proves that the learner
said something to support it, not that the statement restates it faithfully.
That is why Nina reads the statements as data, and why the learner can read,
edit and delete every one. After a complete turn:

1. The gate asks for a message of at least 12 characters with a first-person
   word in Indonesian, English or German. Any other message makes no model call.
2. One call on the background purpose returns at most three candidates, each
   with a verbatim quote and one sentence that is never empty and at most 280
   characters. A sentence that breaks that, or a fourth candidate, makes the
   whole answer invalid, so the call saves nothing. The call reads the
   learner's message and the learner's memories, newest first. Each memory shows
   at most its first 240 characters, and the whole list stays within a token
   budget, so a long list loses its oldest memories. A candidate that repeats
   one of them still confirms it by saying the same words. Its usage is
   recorded as agent `memory` in the turn's ledger.
3. The check keeps a candidate only when its quote is in the message once
   lower-cased and with whitespace collapsed, neither its text nor its quote
   holds an email address, a link or eight digits in a row, and a situation has
   an end day of today or later. A dash, a dot or a space ends a run of digits,
   so a date such as 20-10-2026 stays.
4. The write first checks what could have changed while the model read the
   message. Paused memory, a deleted turn, and a memory that the call read and
   that is gone now (the learner removed it, or it ended) each stop it. It reads
   no chat, so whether the chat still exists changes nothing. Then it confirms
   the memory a candidate names or repeats, or adds a new one. A candidate may
   confirm a memory of its own kind or a memory without a kind, which only the
   learner can have written. It never confirms a memory of another kind, so a
   situation's end day never lands on a goal. Confirming moves the confirmation
   time. A memory is changed since the call read it when it was written, edited
   or confirmed after the call read what it knows, which includes a memory the
   call did not read at all. When nobody changed the memory since, confirming
   also gives it the candidate's kind and, for a situation, its end day. A
   changed memory keeps its words, its kind and its end day, so the learner's
   newer words win. A memory the learner wrote therefore has no kind until a
   chat says it again, and keeps having none when it was changed since the call
   read it. A repeat is the same normalized text or a word overlap of at least
   0.8 with the words of a memory the candidate can confirm; the title of a
   memory is never compared. At 100 memories the Nina-written one confirmed
   longest ago leaves, whichever was created first; when the learner wrote them
   all, the new one is dropped.

Nina never replaces words the learner wrote. A candidate that names a memory the
learner wrote and says something else than that memory does not confirm it. It
becomes a new memory of Nina's, and the learner's memory stays exactly as it
is, with its words, title, kind and confirmation time. A candidate that says the
same as a memory the learner wrote confirms it as step 4 says, and leaves its
words and its author. Only the words of a memory Nina wrote are replaced, by a
candidate that says something new rather than the same words in another case,
punctuation or spacing, and only when nobody changed the memory since the call
read it.

A capture that fails logs one warning with routing facts and changes nothing. It
never cancels the title, the suggestions or the summary.

Nina reads at most 20 memories in a turn. The selection drops an ended
situation, then puts first what the learner wrote, then what is linked to the
open lesson, then the most recently confirmed. They sit in a block that names
them as facts the learner told Nina, never instructions, within the learner
block's token budget. Each memory is one line, `- (kind) Title: words`, with
`(kind) ` left out when it has no kind, the title and its colon left out when it
has no title, and the words and the colon left out when it has none. Its
whitespace is collapsed, so the Markdown of a memory can never open a new
section of the prompt. The capture call reads every memory with its id, as
`- [id] (kind) Title: words`, but only the first 240 characters of the title and
words together, followed by `...` when they are longer, so its prompt stays
small when a learner keeps 100 long memories. The Memory page marks the
memories in use.

A memory is independent of chats. Deleting a chat deletes no memory, not even
one Nina wrote from that chat. Only four things delete a memory:

- The learner deletes one memory, or all of them, on the Memory page.
- A daily job deletes the situations whose end day has passed, 200 per call, and
  schedules itself again while a call is full.
- At 100 memories, a new memory from Nina replaces the Nina-written one that was
  confirmed longest ago.
- Account deletion removes the learner's memories in bounded batches, before the
  learner's vault key goes. Every pass looks for memories first, so a capture
  still running when the deletion starts is swept by the next pass, and one that
  lands after the key is gone seals nothing, because a deleted account gets no
  new key. The capture write needs no check of its own for a deleted account.

## Implementation Contract

- `ninaMemories` (index by user, index by end time) replaces the document with a
  `facts` array. No table ties a memory to a chat, and the chats trigger touches
  no memory.
- `nina/memory:list`, `add`, `edit`, `remove`, `pause` and `clear` are public,
  pass the session middleware, and act only on the signed-in learner. `add` and
  `edit` fail with `NinaMemoryRejected` for `empty`, `limit` and `missing`.
  `empty` means the write holds neither a title nor words, and it is checked
  first, before the limit and before the memory is read. A title of more than 80
  characters, or of only spaces, never reaches the function: its arguments refuse
  it. `read`, `capture` and `expire` are internal.
- `add` and `edit` take the words and an optional title, never a kind, so the
  learner never picks or changes a kind. `add` stores a memory with no kind and
  the learner as author. Editing a memory changes its words and its title, makes
  the learner its author, and leaves its kind, lesson and end time as they are.
  A write without a title takes the title off the memory, which is how the
  learner removes one. A chat rewrites only words that Nina wrote, so the Memory
  page never shows Nina's wording as the learner's own, and the learner's words
  are never replaced by a chat.
- The Memory page lists the title and the words and never a kind. `read` gives
  Nina and the capture call a kind and a title only for a memory that has them.
- `capture` takes the turn, not the chat: it writes only while the turn exists
  and memory is not paused.
- The turn stores `remembered`, how many memories its capture wrote or
  confirmed. The turn summary carries that count, as it carries the credits and
  the usage, so the answer can link to the Memory page. It holds no words.
- The documents of the old model, one per learner with a `facts` array, are
  deleted before this schema deploys. Convex refuses a schema that a stored
  document does not match, so a deploy that succeeds proves that none is left.
- `get`, `enable`, `disable` and `forget` stay only for browser tabs opened
  before October 2026, which still show the old settings card. That card shows
  memory as it is: on with no fact to list, or off. Its "Turn on" button turns
  memory on, and its "Turn off and forget" button turns memory off and deletes
  every memory, as the card says. `forget` changes nothing, because the card
  has no fact to forget. They are deleted with the retired model key.
- The learner profile derived on read, which ADR 0010 defined, is unchanged.
