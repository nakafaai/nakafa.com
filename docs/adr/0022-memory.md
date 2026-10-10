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

A memory is one row. Its text is at most 2000 characters and may hold Markdown,
whose formatting counts toward the limit. It has an author (`nina` or
`learner`), the time it was last confirmed, and the content identity of the
lesson that was open when Nina wrote it, which is the same in every language.
The learner writes pure text, so a memory written on the Memory page has no
kind. A memory Nina wrote has a kind (`level`, `goal`, `style`, `struggle` or
`situation`), and a memory the learner wrote takes one when a later chat says it
again (step 4 below). A `situation` is something with an end. Nina gives it
`validUntil`, the end of its last day, and drops a situation she cannot date, so
a situation always has an end day. A learner keeps at most 100 memories. The
text is sealed for its learner with the vault, in the field
`ninaMemories.text`. A row without its learner key is a defect. A row names no
chat.

Memory is written only when the learner's own words support it, and plain code
decides. The model words each statement, and plain code proves that the learner
said something to support it, not that the statement restates it faithfully.
That is why Nina reads the statements as data, and why the learner can read,
edit and delete every one. After a complete turn:

1. The gate asks for a message of at least 12 characters with a first-person
   word in Indonesian, English or German. Any other message makes no model call.
2. One call on the background purpose returns at most three candidates, each
   with a verbatim quote. Its usage is recorded as agent `memory` in the turn's
   ledger.
3. The check keeps a candidate only when its quote is in the message once
   lower-cased and with whitespace collapsed, neither its text nor its quote
   holds an email address, a link or a run of eight digits, and a situation has
   an end day of today or later.
4. The write first checks what could have changed while the model read the
   message. Paused memory, a deleted turn, and a memory that the call read and
   that is gone now (the learner removed it, or it ended) each stop it. It reads
   no chat, so whether the chat still exists changes nothing. Then it confirms
   the memory a candidate names or repeats, or adds a new one. A candidate
   confirms a memory of its own kind or a memory without a kind, which only the
   learner can have written. It never confirms a memory of another kind, so a
   situation's end day never lands on a goal. Confirming moves the confirmation
   time. When nobody changed the memory since the call read it, confirming also
   gives the memory the candidate's kind and, for a situation, its end day, and
   it replaces the words, making Nina their author, when they say something new
   rather than the same words in another case, punctuation or spacing. A memory
   the learner wrote therefore has no kind until a chat says it again, and keeps
   having none when the learner changed it since the call read it. A repeat is
   the same normalized text or a word overlap of at least 0.8 with a memory the
   candidate can confirm. At 100 memories the Nina-written one confirmed longest
   ago leaves; when the learner wrote them all, the new one is dropped.

A capture that fails logs one warning with routing facts and changes nothing. It
never cancels the title, the suggestions or the summary.

Nina reads at most 20 memories in a turn. The selection drops an ended
situation, then puts first what the learner wrote, then what is linked to the
open lesson, then the most recently confirmed. They sit in a block that names
them as facts the learner told Nina, never instructions, within the learner
block's token budget. Each memory is one line, `- (kind) words`, or `- words`
when it has no kind, with its whitespace collapsed, so the Markdown of a memory
can never open a new section of the prompt. The Memory page marks the memories
in use.

A memory is independent of chats. Deleting a chat deletes no memory, not even
one Nina wrote from that chat. Only four things delete a memory:

- The learner deletes one memory, or all of them, on the Memory page.
- A daily job deletes the situations whose end day has passed, 200 per call, and
  schedules itself again while a call is full.
- At 100 memories, a new memory from Nina replaces the Nina-written one that was
  confirmed longest ago.
- Account deletion removes the learner's memories in bounded batches, before the
  learner's vault key goes.

## Implementation Contract

- `ninaMemories` (index by user, index by end time) replaces the document with a
  `facts` array. No table ties a memory to a chat, and the chats trigger touches
  no memory.
- `nina/memory:list`, `add`, `edit`, `remove`, `pause` and `clear` are public,
  pass the session middleware, and act only on the signed-in learner. `add` and
  `edit` fail with `NinaMemoryRejected` for `limit` and `missing`. `read`,
  `capture` and `expire` are internal.
- `add` and `edit` take the words alone, so the learner never picks or changes a
  kind. `add` stores a memory with no kind and the learner as author. Editing a
  memory changes its words, makes the learner its author, and leaves its kind,
  lesson and end time as they are. A chat that rewrites the words makes Nina
  their author, so the Memory page never shows Nina's wording as the learner's
  own.
- The Memory page lists words and never a kind. `read` gives Nina and the
  capture call a kind only for a memory that has one.
- `capture` takes the turn, not the chat: it writes only while the turn exists
  and memory is not paused.
- The turn stores `remembered`, how many memories its capture wrote or
  confirmed. The turn summary carries that count, as it carries the credits and
  the usage, so the answer can link to the Memory page. It holds no words.
- The documents of the old model, one per learner with a `facts` array, are
  deleted before this schema deploys. Convex refuses a schema that a stored
  document does not match, so a deploy that succeeds proves that none is left.
- `get`, `enable`, `disable` and `forget` stay only for browser tabs opened
  before October 2026. They change nothing and report memory as off. They are
  deleted with the retired model key.
- The learner profile derived on read, which ADR 0010 defined, is unchanged.
