# ADR 0022: Nina Memory Is On For Everyone, Typed, Sealed, Searchable, And Independent Of Chats

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
nothing from it. It also has no count limit, and a person does not read all of
it to answer one question. So no function reads all the memories of a learner:
each read goes through an index and is bounded.

A person also reads memory in more than one way: a little is always there, some
comes to mind with the question, and the rest they look for when they need it.
A turn used to start with a fixed block of up to 8 memories in the system
prompt, whatever the learner asked, and Nina had no way to look for more.

## Decision

Memory is on for everyone. The learner reads, adds, edits and deletes memories,
pauses memory, and deletes all of it on one page, Settings, AI, Memory. Pausing
sets `ninaMemoryPaused` on the learner's learning preference and keeps every
row. While paused, Nina saves nothing and reads nothing. Resuming removes the
mark, so a learner who never paused has no mark. Deleting all of it sets
`ninaMemoryClearedAt` on the same row (see Implementation Contract).

A memory is one row. It holds a title, words, or both. The words are at most
2000 characters and may hold Markdown, whose formatting counts toward the limit;
they are empty when the memory is only a title. The title is optional and at
most 80 characters, and only the learner writes it: Nina never gives a memory a
title. A memory has an author of its words (`nina` or `learner`), the time it
was last confirmed, and its topics: the places it was said at, which are the
lessons and the paths of the pages that were open, at most 8 (see Index And
Search). A lesson is named by its content identity, which is the same in every
language. The learner writes pure text, so a memory written on the Memory page
has no kind and no topic. A memory Nina wrote has a kind (`level`, `goal`,
`style`, `struggle` or `situation`), and a memory the learner wrote takes one
when a later chat says it again (step 4 below). A `situation` is something with
an end. Nina gives it `validUntil`, the end of its last day, and drops a
situation she cannot date, so a situation always has an end day. What Nina
writes is one sentence of at most 280 characters. A learner keeps as many
memories as they write. The words and the title are each sealed for their
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
   characters. The sentence states the fact in the language the learner wrote,
   as a note the learner writes to themself, and leaves the learner out: "Kelas
   12 IPA." and "Prefers worked examples before formulas.", never "Learner
   berada di kelas 12 IPA." A sentence that breaks the length, or a fourth
   candidate, makes the whole answer invalid, so the call saves nothing. The
   call reads the learner's message and the at most 12 memories that match the
   message and the open page best, found by search. Each memory shows at most
   its first 240 characters, and the whole list stays within a token budget, so
   a list that does not fit loses its last memories. A candidate that repeats
   one of them still confirms it by saying the same words. Its usage is
   recorded as agent `memory` in the turn's ledger.
3. The check keeps a candidate only when its quote is in the message once
   lower-cased and with whitespace collapsed, its text has a letter or a digit,
   its text does not label the learner, neither its text nor its quote holds an
   email address, a link or eight digits in a row, and a situation has an end
   day of today or later. A dash, a dot or a space ends a run of digits, so a
   date such as 20-10-2026 stays. A text labels the learner when it starts with
   a word that names them (Learner, Student, Pupil, User, Siswa, Murid,
   Pelajar, Pembelajar, Pengguna, Lernende, Schüler, Nutzer, Benutzer, with the
   article that may lead it) or holds an English label that the learner's own
   words do not hold. The check drops such a candidate and does not rewrite it,
   because a rewrite could say something the learner did not. Memories saved
   before this rule keep their words until the learner says them again, which
   replaces the words of a memory Nina wrote, or edits them.
4. The write first checks what could have changed while the model read the
   message. Paused memory, a deleted turn, and a memory that the call read and
   that is gone now (the learner removed it, or it ended) each stop it. It looks
   up each memory the call read, at most 12, by its id, and reads no chat, so
   whether the chat still exists changes nothing. Then it confirms the memory a
   candidate names or repeats, or adds a new one. A candidate may confirm a
   memory of its own kind or a memory without a kind, which only the learner can
   have written. It never confirms a memory of another kind, so a situation's
   end day never lands on a goal. Confirming moves the confirmation time. A
   memory is changed since the call read it when it was written, edited or
   confirmed after the call read what it knows, which includes a memory the call
   did not read at all and a memory that an earlier candidate of the same call
   wrote or confirmed. When nobody changed the memory since, confirming also
   gives it the candidate's kind and, for a situation, its end day. A changed
   memory keeps its words, its kind and its end day, so the learner's newer
   words win. A memory the learner wrote therefore has no kind until a chat says
   it again, and keeps having none when it was changed since the call read it. A
   repeat is the same normalized text or a word overlap of at least 0.8 with the
   words of a memory the candidate can confirm; the title of a memory is never
   compared, and a text with no words, such as the empty words of a memory that
   is only a title, repeats nothing. The memories a candidate can confirm are the
   one it names, when the call read it, and the 8 that match its words and the
   open page best, found by search. A new memory gets the topics of the open
   page, and a confirmed memory gains the topics it lacks, at most 8 in all.

Nina never replaces words the learner wrote. A candidate that names a memory the
learner wrote and says something else than that memory does not confirm it, and
the name counts for nothing: the candidate is matched by its words like one that
names no memory. It confirms a memory of Nina's that already says the same, and
otherwise becomes a new memory of Nina's. The learner's memory stays exactly as
it is, with its words, title, kind and confirmation time. A candidate that says
the same as a memory the learner wrote confirms it as step 4 says, and leaves
its words and its author. Only the words of a memory Nina wrote are replaced, by
a candidate that says something new rather than the same words in another case,
punctuation or spacing, and only when nobody changed the memory since the call
read it.

A capture that fails logs one warning with routing facts and changes nothing. It
never cancels the title, the suggestions or the summary, and none of them
cancels it: the capture, the summary and the title with the suggestions run side
by side, each to its end, even when one dies, and the failures of all are raised
together once all have ended.

Nina reads memory in three ways, described under Three Ways To Read Memory
below. A memory is one line wherever a prompt carries it. Its whitespace is
collapsed, so the Markdown of a memory can never open a new section of the
prompt, and its angle brackets are written as `&lt;` and `&gt;`, so a memory can
never close the block it sits in. The capture call reads each memory with its
id, as `- [id] (kind) Title: words`, but only the first 240 characters of the
title and words together, counted by code point so that a cut never leaves half
of an emoji, followed by `...` when they are longer, so its prompt stays small
whatever a learner keeps.

## Three Ways To Read Memory

A learner keeps as many memories as they write, and a turn must neither read
them all nor carry them all. So Nina has a tiny part that is always there, a
list that fits the question, and a tool she drives herself, and only the build
of the first calls a model, in the background:

| Way | Where it sits | Tokens at its bound | Typical learner | Documents it reads | Model calls |
| --- | --- | --- | --- | --- | --- |
| Portrait | The Learner section of the system prompt, after the account facts | 300, and 348 with its block | 154 to 171 | 2 | None in the turn |
| Recall | A list in the text part in front of the learner's message | 700, and 757 with its block | 110 to 144 | 435 at most | None |
| Memory capability | The answer to a tool call Nina makes, only when she makes it | 1,500, and 1,555 with its block | 89 to 142 a call | 405 at most for one call | None |

The tokens are counted with the tokenizer behind every Nina budget
(`gpt-tokenizer`). A bound cuts the memories' text, and the block around it,
which is a heading, one sentence that names it as data and its tags, adds 48,
57 and 55 tokens. A typical learner is a portrait of 500 characters and three
to five one-sentence memories, measured on 12 October 2026 in Indonesian and
English. A portrait of 1,200 characters, the most the build may write, measures
249 to 292 tokens, so the character limit and the token bound agree for
ordinary text, and the cut only guards against odd text. Offering the tool costs
416 tokens in every turn while memory is on, whether or not Nina calls it: 191
for its paragraphs of the tool policy and 225 for its definition. The other
three tools cost 388, 392 and 362 tokens as definitions.

The documents of the portrait are its row and the learner's key. Recall is one
search (410 at most: one memory to know there is one, the key, 16 keys of 24
rows, and 24 memories) and, when fewer than three memories match, a fill (25 at
most: the 24 newest, and the key). With the learner's memory state that is 438
documents in the query `read`, and the turn reads one more, the message it
answers, in its own query, to know the learner's words. So a turn reads 439
documents for memory in the worst case, and 2 while memory is paused. The
capability's call is one search of 6 memories (404 at most) and the memory
state, 405 documents, and Nina is told to make at most two calls in a turn.
Every figure is far under the 32,000 documents that one transaction may read.
No way writes anything: a memory that was recalled is not thereby confirmed.

**The portrait** is one text about the learner, written from their memories:
who they are, what they aim for, how they like to learn and what they find hard,
in plain third-person sentences in the language most of the memories use, at
most 1,200 characters. It leaves out anything with an end date, anything said
once in passing and every detail that matters to one lesson, and it states no
fact that no memory states. It sits in a block that names it as data the learner
shared, never instructions, and it is cut to 300 tokens. The system prompt is
the same bytes for two turns of one learner on one page while the portrait does
not change, whatever the learner asks, because nothing that varies with the
question is in it. This keeps the cached prefix of the prompt, which the next
turn reads from the provider's cache (ADR 0019).

**Recall** is the memories that fit this question and this page: the search of
the index (see Index And Search) with the words of the learner's message and the
topics of the open page, at most 8, the best first. When fewer than 3 match, the
most recently confirmed memories that are not there yet and have not ended fill
the list up to 3, so a learner with a few memories is still known whatever they
ask. The fill looks at the 24 newest, because a situation that has ended stays
stored until the daily job deletes it. The list sits in the text part in front
of the newest learner message, after the cache marker, so it never changes the
cached prefix. Each memory is a line with its title and words cut to 300
characters and the day the learner last said it, in a block that names the
memories as facts the learner told Nina, never instructions, cut to 700 tokens.
A learner with no memory gets no list and no heading.

**The memory capability** is the tool `memory`, with one input, `query`: what
Nina is looking for, in the learner's words, at most 200 characters. It answers
with the search for the words of the query, at most 6 memories, each in full up
to 800 characters, in the same kind of block cut to 1,500 tokens, or with one
line that says nothing was found. It makes no model call, so it costs no credits
and needs no specialist. What it finds is read once, in the step after the
call, and is never stored: the conversation keeps the call and a note that
memories matched, not their words. A result that the chat kept would be
readable in the transcript of a public chat, would be read again by every later
turn of the chat, and would outlive the memory it came from. The turn holds the
words while it runs and drops them when it ends, and a later turn that reads
the call reads the note and searches again when it matters. The tool description
and the tool policy tell Nina when to use it: when the learner points back to
something they told her that is neither in the Learner section nor in the list
("like I said", "my schedule", "what do you remember about me"), or when a good
answer depends on a personal fact that is likely saved and is not in front of
her, such as a target, an exam date or how they like explanations; and not for
lesson content, for facts stated in this conversation, or more than twice in one
turn. The twice is an instruction and not a limit in code: a turn still ends
after 20 steps. In the chat it is one activity row, "Recalled memories", with no
count and nothing to open, because a memory's text is not shown in the chat.

While memory is paused none of the three is there: no portrait, no list, and the
tool is not offered. Its paragraph leaves the tool policy too, and a call that
still reaches the function, because the learner paused during the turn, gets a
refusal. Every Nina turn has a signed-in learner, so no other case exists.

**What a learner's delete does to each way.** Recall and the capability read the
live index and the live rows, so a memory the learner deleted or rewrote is gone
or new for the next turn and the next call, and "Delete all" hides at once what
it took (see Implementation Contract). The chat keeps no copy of either: the
memories a turn recalls travel with the learner's message and are never stored,
and the words the capability finds are never stored. What Nina says in an answer
is part of the chat, like anything said in it, and a delete does not take it
back from an answer already given. The portrait is derived from the memories,
so a delete or a rewrite on the Memory page takes its text out in the same
transaction, and no prompt carries a sentence that came from the memory from
then on. It asks for a build from scratch (no old portrait in the input,
the newest 40 memories), which is not bound by the day. The worst-case delay is
therefore not for the sentence, which is gone at once, but for Nina to have a
portrait again: the quiet of 30 seconds that a build waits for, and one model
call (at most 45 seconds). When that call fails, the portrait stays absent until
a later change asks: a delete or a rewrite asks at once, and an added memory
asks when no build has gone to the model in the last day. "Delete all", the daily
expiry that leaves a learner with no memory, and account deletion delete the
portrait with the memories. A portrait is derived data, so deleting it loses
nothing.

**Why the portrait is built in the background.** A model call takes seconds and
costs money that the learner's turn should neither wait for nor pay, and a text
that changed with every question would break the cached prefix. So no turn
builds it. A memory that Nina saves, or the learner adds, asks for a build
unless one went to the model in the last day. The day is counted from that
build (`builtAt`), not from the last request, so a request that no build
answered, such as one whose build found memory paused, does not close it, and a
build that had no lasting memory to hand on does not either. A request writes
its time into the portrait row and schedules the build after 30 seconds. Every
request that comes before a build has gone to the model does this, so the quiet
counts from the last of them and only the last of the builds scheduled finds it
over: a learner who adds three memories within a minute, or writes a memory and
saves it every few seconds, makes one model call. A build claims the work
first, which moves the time of the request to now, so two builds due at the same
moment cannot both go on. A memory added after that build waits for the day to
be over and for a request after it; the portrait may therefore lag the memories
by more than a day, and the memory stays reachable by recall and the capability
meanwhile.

The build reads the portrait as it stands and the memories confirmed after what
it has read, at most 40, each as its title and words cut to 400 characters, and
writes the whole new text, keeping what the old one says unless a newer memory
contradicts it. When more than 40 are new, it reads the newest 40 and moves past
the rest, and no later build reads them: what the portrait has read is one
moment, and a build reads on from it. They stay stored and recallable, and only
the portrait leaves them out. A build from scratch reads the 40 newest memories
the learner has, so a learner with more keeps a portrait of their latest. Reading
every memory, oldest first, would cost a model call for every 40 a learner
keeps, on every delete or rewrite. A situation is never handed to it, because it
has an end date.
It writes only if the portrait is still the one it read and every memory it fed
to the model is as it read it, so a build that was running when the learner
deleted or rewrote a memory, or deleted them all, or paused memory, stores
nothing. A build with no memory newer than the portrait asks no model. The
tokens of its one call are added to the portrait row (`usage`: the calls and
their input and output tokens), as a summary's are to its row, because a build
belongs to no turn and so to no turn's usage ledger. They count when the text is
not stored too.

A memory is independent of chats. Deleting a chat deletes no memory, not even
one Nina wrote from that chat. Only three things delete a memory, and each
deletes its key rows with it:

- The learner deletes one memory, or all of them, on the Memory page.
- A daily job deletes the situations whose end day has passed, 25 per call, and
  schedules itself again while a call is full.
- Account deletion removes the learner's memories in bounded batches, and
  their portrait, before the learner's vault key goes. Every pass looks for
  memories and the portrait first, so a capture still running when the deletion
  starts is swept by the next pass, and one that lands after the key is gone
  seals nothing, because a deleted account gets no new key. The capture write
  needs no check of its own for a deleted account.

## Index And Search

A learner finds a memory by what it says and where it was said, never by
reading all of them. The index is the table `ninaMemoryKeys`: one row links one
memory to one key, and two memories are linked when they share a key. A key is
one of two kinds:

- A topic key, `t:<topic>`, in plain text, because a topic names a page of
  Nakafa and not the learner. A page has the topic `lesson:<identity>` when it
  shows a lesson, and a topic `path:<route>` for each path above its slug that
  has at least two segments, the deepest first. The page
  `materials/mathematics/limits/concept` has `path:materials/mathematics/limits`
  and `path:materials/mathematics`. The first segment is the whole surface,
  which every page shares and which says nothing. A page has at most 8 topics.
- A word key, `w:<hash>`, which is blind. One function turns the words of the
  title, and then the words of the text, into the words that are indexed, and
  the writer and every search use it: Unicode NFKC, lower case, runs of letters
  or digits. A run shorter than 3 characters is dropped unless it is a number of
  at least 2 digits, and so is every stop word of Indonesian, English and
  German in a short fixed list. Each run is cut to its first 6 characters, so
  that trigonometri, trigonometry and Trigonometrie are one word. A memory
  indexes at most 96 words. The key is an HMAC-SHA-256 of the word, cut to 16
  bytes, under a third key of the learner's vault key that is used for nothing
  else, and bound to the table and the field. The database can match a word
  again without reading it, and the same word is another key for another
  learner.

The index uses no embeddings. A vector index holds its vectors in plain form,
and an embedding can be turned back into the text it stands for, so it would
give away the text that the vault seals.

Every key row also holds the time its memory was confirmed, and the index
orders the rows of one key by it. A key therefore leads to the memories
confirmed last, whenever they were written: a memory that the learner says
again and again stays among the first that a lookup meets, however many
memories were written after it. Every writer of a memory keeps its keys in step
with it in the same transaction, the time included: `add`, `edit`, and the
capture write (a new memory, and a confirmed memory, which gives its keys the
time of the confirmation and its new words and topics). Every path that deletes
a memory deletes its keys: `remove`, `clear`, the daily expiry, account
deletion, and the retired `disable`.

One function searches: `searchMemories` takes the learner, the text, the
topics, a limit and the moment the learner last deleted all of it, if ever. It
looks up at most 16 keys, the topics first, and reads the 24 memories confirmed
last for each. A memory scores 3 for the lesson that is open, 2 for a path
above it, and 1 for each word. The memories go by score and then by the time
they were last confirmed, the newest first, and the best three times the limit,
at most 48, are loaded. Those that are gone or are situations that ended drop
out, and the first of the rest, as many as the limit, are the result. It reads
at most 434 documents of the 32,000 that one transaction may read, whatever the
learner keeps: a word that many memories hold finds the ones confirmed last
that hold it, not every one. The capture call asks for 12 memories, the write
for 8 for each candidate, a turn for up to 8 by the learner's words and the
topics of the page, and the memory capability for 6 by Nina's query. The Memory
page does not use it: its search runs in the browser.

## Implementation Contract

- `ninaMemories` (index by user and confirmation time, index by end time)
  replaces the document with a `facts` array, and `ninaMemoryKeys` (index by
  user, key and confirmation time, index by memory) is its index. No table ties
  a memory to a chat, and the chats trigger touches no memory.
- `nina/memory:list`, `state`, `add`, `edit`, `remove`, `pause` and `clear` are
  public, pass the session middleware, and act only on the signed-in learner.
  `list` is paginated, the most recently confirmed memory first, and holds at
  most 50 memories to a page; a visitor gets an empty page. `state` tells
  whether memory is paused. `add` and `edit` fail with `NinaMemoryRejected` for
  `empty` and `missing`. `empty` means the write holds neither a title nor
  words, and it is checked first, before the memory is read. A title of more
  than 80 characters, or of only spaces, never reaches the function: its
  arguments refuse it. `read`, `known`, `lookup`, `capture`, `drain` and
  `expire` are internal.
- `ninaMemoryPortraits` (index by user) holds one row for a learner who has
  asked for a portrait: its sealed `text`, absent until a build has written
  one and after a memory was deleted or rewritten; `through`, the newest
  confirmation time the text has read, zero for none; `scheduledAt`, the time
  of the last request; `builtAt`, the time the last build went to the model,
  absent for none; and `usage`, the tokens of the model calls of its builds,
  absent for none. The text is sealed for the learner in its own
  field, like a memory. `nina/portrait:claim` and `save` are internal, and so
  is the scheduled node action `nina/portrait/build:run`.
- `clear` stores the moment the learner asked, as `ninaMemoryClearedAt` on
  their learning preference, deletes the learner's portrait in the same
  transaction, and deletes a batch of 25 memories with their keys. `drain`
  deletes the next batch, again and again, until none is left, so one
  transaction never deletes more than 25 memories and 2,625 documents. `clear`
  returns at once. The batches delete the memories confirmed up to that moment,
  so a memory the learner or Nina writes while they still run stays. The daily
  expiry deletes a batch of 25 ended situations the same way, and deletes the
  portrait of each learner it leaves with no memory at all.
- From the moment `clear` stores it, every reader drops the memories confirmed
  at or before it, on every device and for Nina's next turn, though the batches
  may still hold them. Without that, the list would show the rest again once
  the page stopped hiding them, another device would show them, and the next
  turn could still use them. The readers are `list`, `read`, `lookup`, `known`,
  the search they and the capture write use, and the capture write's lookups by
  id, which count such a memory as gone, so a chat never confirms and brings
  back what the learner deleted. `edit` refuses such a memory as missing for the
  same reason.
  A reader that takes the newest first only drops the tail: the search, the
  fill of the recall and the keys read memories above that moment in their
  index ranges, so each read stays on its index and bounded, and `list` cuts
  its page at the first memory it drops and ends the list there. `list` keeps
  its index range whatever the learner did, because the cursors of the pages a
  browser holds belong to that range.
- `add` and `edit` take the words and an optional title, never a kind, so the
  learner never picks or changes a kind. `add` stores a memory with no kind and
  the learner as author. It reads the moment of the last Delete all, as `edit`
  and the capture write do, and confirms the memory after it: the database runs
  the write again when a Delete all commits while it runs, and a clock that has
  not moved on never stamps the memory as one the deletion took, which every
  reader would hide and no batch might delete. Editing a memory changes its
  words and its title, makes the learner its author, and leaves its kind,
  topics and end time as they are. A write without a title takes the title off
  the memory, which is how the learner removes one. A chat rewrites only words
  that Nina wrote, so the Memory page never shows Nina's wording as the
  learner's own, and the learner's words are never replaced by a chat.
- The Memory page lists the title and the words and never a kind. It shows
  every memory a learner has, however many: the settings route reads the first
  page of 30 memories and whether memory is paused for the first paint, and one
  reader in the browser then loads the next page when the end of the list comes
  into view. A list of a page or more is windowed: only the rows in view and a
  few around them are in the page, except that the rows the server rendered
  stay until the learner first scrolls, so hydration moves none of them. Every
  row has the same fixed height, in pixels, so the window knows where each
  stands before it has measured any. A shorter list is not windowed, because the
  window shows only the rows it started with until the learner scrolls and
  would start again, with every row, each time the count changed: its rows are
  all in the page and stay in place while memories come and go.
- The Memory page searches in the browser alone, in any part of a word of the
  title and the words of the memories it holds. While the search box holds text,
  the reader loads the pages that are not loaded yet, 50 at a time (the most a
  page holds), until every memory is loaded, and a row that matches appears as
  its page arrives and stays while it matches. "No memory found" shows only when
  every page is loaded and nothing matches. The server has no search for the
  page: its index holds only the first 6 characters of each word, as blind keys
  of the sealed text, so a part from the middle or the end of a word, or a word
  under an affix or inside a compound, finds nothing there. Mixed with the
  browser's filter it also made rows leave and come back while a learner typed,
  and the browser's filter alone finds any part of a word and keeps a row for as
  long as it matches.
- The editor holds the memory it opened: opening it stores the memory in the
  page's state, and the editor never looks it up in the list again, so changing
  the search or the pages that are loaded never closes it. The learner closing
  it, the learner deleting that memory (from its row, from the editor, or with
  Delete all), and a save answered with `missing` are the only things that
  close it. A new memory whose first save is on its way when the learner
  deletes everything is among the memories the server deletes, so its editor
  closes when the server answers the save, and nothing more is written. It is
  one editor in the panel beside the page and in the sheet, so a window that
  crosses the width where the two swap loses nothing the learner wrote. After a
  save that failed the editor opens again with the words the server never took,
  and the next close writes them, whatever the memory on the page shows.
- Every change shows at once on every loaded page and rolls back when it fails.
  A change made before the live list has answered shows when it answers,
  because the browser has no page of its own to change until then.
- `read` gives a turn the account profile, the portrait when the learner has
  one, and the at most 8 memories that the learner's words and the topics of
  the open page recall. `known` gives the capture call the account profile and
  the at most 12 memories that match the message and the topics of the open
  page. `lookup` gives the memory capability the at most 6 memories that match
  Nina's query. A memory comes with a kind and a title only when it has them,
  and none of them gives a portrait or a memory while memory is paused. `lookup`
  also tells that memory is paused, so the capability can refuse.
- The turn reads the learner's words from the message it answers, one document
  of the Agent component, before it calls `read`, and the account deletion
  cleanup deletes the portrait with the memories, a pass at a time, so a
  portrait that a capture still running asks for is deleted by the next pass.
- `capture` takes the turn, not the chat: it writes only while the turn exists
  and memory is not paused. It takes the topics of the open page and the at most
  12 memories the call read.
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
  every memory in batches, as `clear` does, as the card says. `forget` changes
  nothing, because the card has no fact to forget. They are deleted with the
  retired model key.
- The learner profile derived on read, which ADR 0010 defined, is unchanged.
