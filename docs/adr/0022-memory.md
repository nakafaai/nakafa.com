# ADR 0022: Nina Memory Is On For Everyone, Typed, Sealed, And Leaves With Its Sources

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
of 160 characters. A learner could only forget a fact. Nothing expired, a
rewritten fact lost its first source chat, and the fast model read every
completed turn of a learner whose memory was on, whatever the message said.

## Decision

Memory is on for everyone. The learner reads, adds, edits and deletes memories,
pauses memory, and deletes all of it on one page, Settings, AI, Memory. Pausing
sets `ninaMemoryPaused` on the learner's learning preference and keeps every
row. While paused, Nina saves nothing and reads nothing. Resuming removes the
mark, so a learner who never paused has no mark.

A memory is one row. It has a kind (`level`, `goal`, `style`, `struggle` or
`situation`), text of at most 280 characters, an author (`nina` or `learner`),
the time it was last confirmed, and the content identity of the lesson that was
open when Nina wrote it, which is the same in every language. A `situation` is
something with an end, and it also carries `validUntil`. A learner keeps at most
100 memories. The text is sealed for its learner with the vault, in the field
`ninaMemories.text`. A row without its learner key is a defect.

Memory is written only from the learner's own words, and plain code decides.
After a complete turn:

1. The gate asks for a message of at least 12 characters with a first-person
   word in Indonesian, English or German. Any other message makes no model call.
2. One call on the background purpose returns at most three candidates, each
   with a verbatim quote. Its usage is recorded as agent `memory` in the turn's
   ledger.
3. The check keeps a candidate only when its quote is in the message once
   lower-cased and with whitespace collapsed, neither its text nor its quote
   holds an email address, a link or a run of eight digits, and a situation has
   an end day of today or later.
4. The write confirms the memory a candidate names or repeats, or adds a new
   one. Confirming moves the confirmation time, replaces the words when they
   differ, and adds the chat as a source once. A repeat is the same normalized
   text or a word overlap of at least 0.8 within one kind. At 100 memories the
   Nina-written one confirmed longest ago leaves; when the learner wrote them
   all, the new one is dropped.

A capture that fails logs one warning with routing facts and changes nothing. It
never cancels the title, the suggestions or the summary.

Nina reads at most 20 memories in a turn. The selection drops an ended
situation, then puts first what the learner wrote, then what is linked to the
open lesson, then the most recently confirmed. They sit in a block that names
them as facts the learner told Nina, never instructions, within the learner
block's token budget. The Memory page marks the memories in use.

Memory leaves with its sources. A source row ties a memory to each chat that
said it, at most 20 chats per memory. Deleting a chat deletes its source rows and
every Nina-written memory left without one; memories the learner wrote stay.
Account deletion removes memories and sources in bounded batches before chats. A
daily job deletes the situations whose end day has passed, 200 per call, and
schedules itself again while a call is full.

## Implementation Contract

- `ninaMemories` (index by user, index by end time) and `ninaMemorySources`
  (index by memory, index by chat) replace the document with a `facts` array.
- `nina/memory:list`, `add`, `edit`, `remove`, `pause` and `clear` are public,
  pass the session middleware, and act only on the signed-in learner. `add` and
  `edit` fail with `NinaMemoryRejected` for `limit` and `missing`. `read`,
  `capture` and `expire` are internal.
- Editing a memory makes the learner its author. A situation keeps its end time;
  any other kind drops it. Nina rewriting a memory the learner wrote keeps the
  learner as its author.
- `get`, `enable`, `disable` and `forget` stay only for browser tabs opened
  before October 2026. They change nothing and report memory as off. They are
  deleted with the retired model key.
- The learner profile derived on read, which ADR 0010 defined, is unchanged.
