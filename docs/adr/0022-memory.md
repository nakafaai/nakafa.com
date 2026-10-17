# ADR 0022: Nina Memory Is On For Everyone, Typed, Sealed, Searchable, And Independent Of Chats

## Status

Accepted. Supersedes ADR 0010, which kept memory off until a learner turned it
on. Amended on 13 October 2026: a Nina thread of a class neither reads nor
writes personal memory (K3) and reads no learner profile, and the Memory page is
never shown inside a school (Memory In A School Thread).

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

Memory is on for everyone, in the personal space. A Nina thread of a class does
not use it (see Memory In A School Thread). The learner reads, adds, edits and
deletes memories, pauses memory, and deletes all of it on one page, Settings, AI,
Memory. Pausing sets `ninaMemoryPaused` on the learner's learning preference and
keeps every row. While paused, Nina saves nothing and reads nothing. Resuming
removes the mark, so a learner who never paused has no mark. Deleting all of it
sets `ninaMemoryClearedAt` on the same row (see Implementation Contract).

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

Memory is written only when the learner's own words support it. A learner
writes anything, in any language and script, so no list of words, no pattern and
no comparison of words decides what a learner meant: a decision model decides
whether a message states something lasting, whether a sentence is the learner's
own note and whether it holds something private (see Judgments), and the
capture model, which reads the memories a learner has, says which one a
sentence restates. The capture model words each statement, and plain code
proves that the learner said something to support it, not that the statement
restates it faithfully. That is why Nina reads the statements as data, and why
the learner can read, edit and delete every one. After a complete turn:

1. The decision model judges the learner's message `lasting`: whether it states
   something that will still matter in later study sessions, such as their
   grade or level, a goal, how they like to learn, something they find hard, or
   a situation with a date. It is sent that message alone, cut to 1,000 tokens,
   and never a name, an id or the conversation. A message it judges not lasting,
   in any language, makes no capture call, and so does a message of only
   whitespace and the message of a learner who paused memory, which is sent to
   no model at all. The pause is read once, before the first model reads the
   message, by the internal query `paused`; a learner who pauses while the
   models read is stopped by the write (step 4).
2. One call on the background purpose returns at most three candidates, each
   with a verbatim quote and one sentence that is never empty and at most 280
   characters. The sentence states the fact in the language the learner wrote,
   as a note the learner writes to themself, and leaves the learner out: "Kelas
   12 IPA." and "Prefers worked examples before formulas.", never "Learner
   berada di kelas 12 IPA." A sentence that breaks the length, or a fourth
   candidate, makes the whole answer invalid, so the call saves nothing. The
   call reads the learner's message and the at most 12 memories that match the
   message and the open page best, found by search. They are listed best first,
   each with its place on the list (`- [1] (level) Kelas 12.`) and at most its
   first 240 characters. The list never holds more than those 12 memories, and
   no budget cuts it, so the model can name every memory it shows. A candidate
   that restates one of them names it by its place, as a whole
   number; a candidate that is new, or that corrects a memory, names none. Its
   usage is recorded as agent `memory` in the turn's ledger.
3. The check turns each claim of the capture model into a candidate, and keeps
   it only when its quote is in the message once lower-cased and with
   whitespace collapsed, its text has a letter or a digit, and a situation has
   an end day of today or later. A claim is a candidate when it fits one of two
   shapes: a situation names a real end day (`YYYY-MM-DD`, and not a day that a
   calendar rolls over, such as February 30) and any other kind has none, so a
   situation without a real day is dropped, and any other kind loses a day it
   was given. The write takes the same two shapes as its argument, so it
   refuses a situation that has no real end day. The model is asked for one
   flat claim, not for the two shapes,
   because a union in a structured output is not known to pass the gateway
   (Gemini's structured output page lists no `anyOf`, read on 12 October
   2026). The check reads structure and never meaning. The candidates that stay
   then go to the decision model, each
   in a request of its own and all at the same time, each as its note: the
   sentence followed by its quote (`Note: ...`, `Quote: ...`). A request asks
   two questions about its note. `ownNote` asks whether the sentence reads as
   the learner's own note, written in the language of the quote, stating the
   fact itself and not describing the learner from the outside as a third
   person would. `private` asks whether the note holds contact details, a home
   address, an identity or account number, a password, or information about
   health, religion, ethnicity, political views or money. A candidate that is
   not the learner's own note, or is private, is dropped, and it is not
   rewritten, because a rewrite could say something the learner did not. The
   candidates that stay keep the order in which the capture model proposed
   them, whichever request is answered first, because the write takes the first
   of the candidates that settle one memory. Memories saved before this rule
   keep their words until the learner says them again, which replaces the words
   of a memory Nina wrote, or edits them.
4. The write first checks what could have changed while the model read the
   message. Paused memory, a deleted turn, and a memory that the call read and
   that is gone now (the learner removed it, or it ended) each stop it. It looks
   up each memory the call listed, at most 12, by its id, and reads no chat, so
   whether the chat still exists changes nothing. Then a candidate confirms the
   memory it names, when the place it names is on the list and that memory is of
   its kind or has none, which only the learner can have written; any other
   candidate adds a new memory. A place that is not on the list names nothing.
   A candidate never confirms a memory of another kind, so a situation's end day
   never lands on a goal, and no comparison of words looks for a memory it did
   not name: a sentence that restates a memory without naming it is added again,
   which the learner can delete. Two candidates of one call that hold the same
   words (up to case, punctuation and spacing), the same kind and the same name
   are one candidate, the first. Confirming moves the confirmation time. A
   memory is changed since the call read it when it was written, edited or
   confirmed after the call listed it, which includes a memory that an earlier
   candidate of the same call wrote or confirmed. When nobody changed the
   memory since, confirming also
   gives it the candidate's kind and, for a situation, its end day. A changed
   memory keeps its words, its kind and its end day, so the learner's newer
   words win. A memory the learner wrote therefore has no kind until a chat says
   it again, and keeps having none when it was changed since the call read it. A
   new memory gets the topics of the open page, and a confirmed memory gains the
   topics it lacks, at most 8 in all.

Nina never replaces words the learner wrote. A candidate that names a memory the
learner wrote confirms it and leaves its words, its title and its author as they
are, whatever the candidate says: the model names a memory only for a sentence
that restates it, so a sentence that corrects a memory is a new memory of
Nina's, and the older sentence stays until the learner deletes it. Only the
words of a memory Nina wrote are replaced, by a candidate that names it with
other words than the same ones in another case, punctuation or spacing
(`sameWords`, an identity check), and only when nobody changed the memory since
the call read it.

A capture that fails logs one warning with routing facts and changes nothing. It
never cancels the title, the suggestions or the summary, and none of them
cancels it: the capture, the summary and the title with the suggestions run side
by side, each to its end, even when one dies, and the failures of all are raised
together once all have ended. A decision that cannot be made, because the
gateway fails or the deadline passes, is such a failure: nothing is stored for
that turn, the capture model is not asked when it was the first decision that
failed, and the warning names the operation (`judge`), the gateway's reason,
status and type, and never the message, a candidate or a quote. A request about
one candidate that fails ends the requests about the others and keeps none of
the candidates. No pattern or list takes the place of the decision model.

Nina reads memory in three ways, described under Three Ways To Read Memory
below. A memory is one line wherever a prompt carries it. Its whitespace is
collapsed, so the Markdown of a memory can never open a new section of the
prompt, and its angle brackets are written as `&lt;` and `&gt;`, so a memory can
never close the block it sits in. The capture call reads each memory with its
place on the list, counted from 1, as `- [1] (kind) Title: words`, but only the
first 240 characters of the title and words together, counted by code point so
that a cut never leaves half of an emoji, followed by `...` when they are
longer, so its prompt stays small whatever a learner keeps.

## Three Ways To Read Memory

A learner keeps as many memories as they write, and a turn must neither read
them all nor carry them all. So Nina has a tiny part that is always there, a
list that fits the question, and a tool she drives herself, and only the build
of the first calls a model, in the background:

| Way | Where it sits | Tokens at its bound | Typical learner | Documents it reads | Model calls |
| --- | --- | --- | --- | --- | --- |
| Portrait | The Learner section of the system prompt, after the account facts | 1,000, plus its block | 154 to 171 (former tokenizer) | 2 | None in the turn |
| Recall | A list in the text part in front of the learner's message | 1,500, plus its block | 110 to 144 (former tokenizer) | 435 at most | None |
| Memory capability | The answer to a tool call Nina makes, only when she makes it | 3,000, plus its block | 89 to 142 a call (former tokenizer) | 405 at most for one call | None |

The bounds are counted by the estimator of `confect/nina/budget.ts`, whose costs
live in the language model profile. The figures without a current count were
measured with the former tokenizer (`gpt-tokenizer`), before the model change of
14 October 2026, and they have not been counted again. A bound cuts the
memories' text, and the block around it, which is a heading, one sentence that
names it as data and its tags, adds 48, 57 and 55 tokens. A typical learner is a portrait of 500 characters
and three to five one-sentence memories, measured on 12 October 2026 in
Indonesian and English. A portrait of 1,200 characters, the most the build may
write, measured 249 to 292 tokens with the former tokenizer, so the character
limit and the token bound agree for ordinary text, and the cut only guards
against odd text. Offering the tool cost 416 tokens in every turn while memory
was on, whether or not Nina called it: 191 for its paragraphs of the tool policy
and 225 for its definition, with the former tokenizer. The other three tools cost
388, 392 and 362 tokens as definitions, with the former tokenizer.

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
turn of the chat, and would outlive the memory it came from. So the words never
sit in the thread, not even for the length of the turn: the answer the tool
returns, which the Agent component saves, holds the note only. The capability
declares the note in its definition, and the shared runner of every capability
applies it: the turn holds the words in memory while it runs and gives them to
the model's next step in place of the note, and drops them when it ends,
whether it completes, fails or is cancelled. A later turn that reads the call
reads the note and searches again when it matters. The tool description
and the tool policy tell Nina when to use it: when the learner points back to
something they told her that is neither in the Learner section nor in the list
("like I said", "my schedule", "what do you remember about me"), or when a good
answer depends on a personal fact that is likely saved and is not in front of
her, such as a target, an exam date or how they like explanations; and not for
lesson content, for facts stated in this conversation, or more than twice in one
turn. The twice is an instruction and not a limit in code: a turn still ends
after 20 steps. In the chat it is one activity row, "Recalled memories", with no
count and nothing to open, because a memory's text is not shown in the chat. The
row is the owner's alone. The call tells what Nina looked for in the owner's
memories, in the owner's words, whether something matched and whether memory is
paused, so a reader of a shared chat is sent no part of it, and no live stream
in which its chunks could travel (ADR 0001). The words Nina writes around the
call, her reasoning and her answer, are the conversation: a reader is sent them
like the rest of her words (ADR 0001).

While memory is paused none of the three is there: no portrait, no list, and the
tool is not offered. The turn reads the pause once, at its start, and the
capability policy follows it like it follows the permissions of the other
capabilities: it leaves the tool out of what Nina is offered, refuses a call,
and the tool policy's paragraph about it leaves the prompt too. A call that
still reaches the function, because the learner paused during the turn, gets
the same refusal from the function, which reads the pause again. Every Nina
turn has a signed-in learner, so no other case exists.

**What a learner's delete does to each way.** Recall and the capability read the
live index and the live rows, so a memory the learner deleted or rewrote is gone
or new for the next turn and the next call, and "Delete all" hides at once what
it took (see Implementation Contract). The chat keeps no copy of either: the
memories a turn recalls travel with the learner's message and are never stored,
and the words the capability finds are never stored. What Nina says in an answer
is part of the chat, like anything said in it: an answer that already holds the
words of a memory the learner then deletes stays until the learner deletes the
chat. That is the one copy a delete does not reach. The portrait is derived from
the memories, so a delete or a rewrite on the Memory page takes its text out in
the same transaction, and no prompt carries a sentence that came from the
memory from then on. It asks for a build from scratch (no old portrait in the
input, every memory the learner has, the oldest first, a page of 40 at a time),
which is not bound by the day. The worst-case delay is therefore not for the sentence, which
is gone at once, but for Nina to have a portrait again: the quiet of 30 seconds
that a build waits for, and one model call (at most 45 seconds), for each page of
40 memories, one page after another. That is at most 75 seconds for each 40
memories the learner keeps, and until the last page the portrait holds the
memories read so far. A delete or a rewrite while the pages are being built
starts them again from the first memory. When a call fails, the portrait stays
as it was, and absent after a delete, until a later change asks: a delete or a
rewrite asks at once, and an added memory asks when no build has gone to the
model in the last day. "Delete all", the daily expiry that leaves a learner
with no memory, and account deletion delete the portrait with the memories. A
portrait is derived data, so deleting it loses nothing.

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

The build reads the portrait as it stands and the next page of memories
confirmed after what it has read: the oldest first, at most 40, each as its
title and words cut to 400 characters. It writes the whole new text, keeping
what the old one says unless a newer memory contradicts it, and a newer memory
comes after the one it may contradict in what the model reads. What the portrait
has read is one moment, the confirmation time of the newest memory of the page,
and the next build reads on from it, so no memory is skipped. A page never ends
between memories confirmed at the same moment (a capture writes up to three at
once), so it may hold fewer than 40; only a group of 40 or more at one moment,
which nothing writes, would lose its rest. When memories remain after a full
page, storing the page asks for the next build, which waits for the quiet of 30
seconds and not for the day. A learner with N memories the portrait has not read
therefore costs one model call for each 40 of them, one after another, and a
build from scratch costs that for every memory the learner has: 25 calls for
1,000 memories, at most 32 minutes if each takes its quiet and its whole 45
seconds. No turn waits for or pays any of it. A series that stops, because the
learner paused memory or the account is going, goes on from where it stopped at
the first request after the day, and a delete or a rewrite starts it again.
The learner who lets Nina use memory again asks for a build too, by the rule of
an added memory: nothing asked while memory was paused, and a build that came
due during the pause built nothing, so the memories written before and during
the pause would otherwise wait for the next one. A situation is never handed to
it, because it has an end date.
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
  their portrait and the records that keep a deleted memory for `restore`,
  before the learner's vault key goes. Every pass looks for memories, the
  portrait and the records first, so a capture still running when the deletion
  starts is swept by the next pass, and one that lands after the key is gone
  seals nothing, because a deleted account gets no new key. The capture write
  needs no check of its own for a deleted account.

## Memory In A School Thread

A Nina thread that belongs to a class (ADR 0025) neither reads nor writes
personal memory (K3). Memory stays on in the personal space as this ADR decides,
and a school thread does not open it. The change is planned for program wave B
(ADR 0013 describes the waves), and no school thread exists yet.

- No read. A turn of a school thread calls none of the memory reads of
  `nina/memory/turn.ts` (`read`, `lookup`, and `known`). It reads no portrait and
  no recalled memory, and it is not offered the memory capability (the offered
  capabilities in `nina/instructions.ts`). The kind of the thread decides, and
  the learner's memory state is not read at all. A paused memory is not the model
  for this: the turn of a paused learner still reads the learner profile,
  because `read` returns `profile` before it looks at the pause.
- No profile. The learner profile is not memory. It is the account facts that
  `readLearnerProfile` returns (`nina/memory/profile.ts`): the onboarding focus
  and region, the preferred try-out country, and the latest finished try-out by
  section. K3 names memory only, and a reply of Nina in a class is read by the
  whole class. So a school thread reads the profile no more than it reads memory,
  which is the separation that ADR 0015 draws for connections. This ADR takes the
  stricter reading of K3.
- No write. No capture is scheduled after a turn of a school thread. The
  learner's message in a class goes to no memory model, and no memory, no key
  row, and no portrait request follows from it.
- The pause is the learner's. A learner who paused memory keeps it paused, and a
  school thread does not depend on it, because it never reads memory.
- A message in a class is school data, sealed with the school key (ADR 0030), and
  not memory. No job copies it into memory.
- The Memory page stays in the personal space. The account menu of the school
  shell links to it (`nakafa.com/id/user/settings/memory`, ADR 0026), and a shell
  of a cell other than `us` shows no such link, because personal Nina memory
  exists only in the `us` cell. The page is never shown inside the shell, so a
  learner never edits or deletes personal memory from within a school. The
  account menu has no entry for a profile, because a school member has no public
  profile (K15).
- The test, with a learner who has memories and a profile: the turn of a school
  thread carries no portrait, no recalled memory, and no profile fact, its
  capability list lacks `memory`, and no capture runs. It plants a string in a
  memory, one in the onboarding focus, and one in a class message. The prompt of
  the school thread holds neither of the first two, and no memory table holds
  the third.

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
  the writer and every search use it: Unicode NFKC, lower case, and then the
  word boundaries of the platform (`Intl.Segmenter`, UAX 29), which keep a word
  or a number and drop punctuation, spaces and emoji. The platform's
  dictionaries split Japanese, Chinese and Thai, which put no space between
  words, so a learner's words in any script have words. No list of words and no
  minimum length decides what a word is, because each would hold for some
  languages and not for others. Each word is cut to its first 6 characters, so
  that trigonometri, trigonometry and Trigonometrie are one word. A memory
  indexes at most 96 words. The key is an HMAC-SHA-256 of the word, cut to 16
  bytes, under a third key of the learner's vault key that is used for nothing
  else, and bound to the table, the field and the version of the index
  (`words/v2`). The database can match a word again without reading it, and the
  same word is another key for another learner.

The version of the index says what a word is. Version 1, whose keys were blinded
for the field `words`, read words by rules that version 2 replaced, and version
2 reads them from the word boundaries of the platform. The version is part of
every word key, so a key of one version never equals a key of another, and a
search never finds a memory by a key of a word that meant something else. A
change in what a word is, including a change in the platform's dictionaries, is
a new version. A memory that was written under an older version is re-keyed by
its next write (the learner's edit, or a capture that names it), because the
sync of its keys deletes the keys it should not have. A new version ships with
a job that re-keys the memories no write touches: a page of memories a call,
each given the keys of the current version from its own words, title and
topics, run by the operator on dev and then on production until it reports
done, and deleted with its tests once both show no memory left to change. Until
it is done, a memory that holds only keys of the older version is found through
its topics and not through its words. The job for version 2 ran on both
deployments on 12 October 2026. Neither held a memory then, so it changed
nothing, and it is deleted; the version stays.

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
a memory deletes its keys: `remove`, `clear`, the daily expiry, and account
deletion. `remove` hands the keys it deletes to the restore record, and
`restore` inserts the same rows again (see Implementation Contract).

One function searches: `searchMemories` takes the learner, the text, the
topics, a limit and the moment the learner last deleted all of it, if ever. It
looks up at most 16 keys, the topics first, and reads the 24 memories confirmed
last for each. When the text has more words than the keys that are left, it
looks up the longest words first, measured as whole words and not as the six
characters the index keeps of each, because a word that is frequent in a
language is short in it, in every language. A memory scores 3 for the lesson that is
open, 2 for a path above it, and for each word 1 divided by the number of
memories the read of the word's key found: a word that only one of the learner's
memories holds is worth 1, a word that two hold 1/2, and a word that most of
their memories hold, such as an article or a particle in any language, is worth
little. The read finds 24 memories at most, so a word that 24 or more memories
hold is worth 1/24, which is less than any word that fewer hold. That is how
the search ignores the words that say nothing, with no list of them. The
memories go by score and then by the time they were last confirmed, the newest
first, and the best three times the limit, at most 48, are loaded. Those that
are gone or are situations that ended drop out, and the first of the rest, as
many as the limit, are the result. It reads at most 434 documents of the 32,000
that one transaction may read, whatever the learner keeps: a word that many
memories hold finds the ones confirmed last that hold it, not every one. The
capture call asks for 12 memories, a turn for up to 8 by the learner's words
and the topics of the page, and the memory capability for 6 by Nina's query.
The write does not search: it reads only the memories the capture call listed.
The Memory page does not use it: its search runs in the browser.

## Judgments

Nina asks every question about a learner's words through one module,
`confect/nina/judgment`. A judgment is an entry of data in its catalog: its
name, the kind of its question (yes or no), the instructions the decision model
reads, and the probability from which its answer counts as yes. The interface of
the module is small: `judge(names, text)` asks the judgments it names about one
text, all of them in one request to the Convex AI gateway (ADR 0019), and
answers with one record of verdicts, true or false for each name. A caller
never sees a probability, a threshold or a model, and adding a judgment is
adding an entry. The instructions of an entry hold in any language and name no
language, no word and no pattern. Three judgments exist:

- `lasting` decides whether the capture model runs for a message.
- `ownNote` is asked of each candidate the capture model proposes, and a
  candidate it judges is not the learner's own note, because it describes the
  learner from the outside, is dropped.
- `private` is asked of each candidate in the same request as `ownNote`, and a
  candidate it judges private is dropped.

What is sent to the decision model is the least text that answers the question:
the learner's message for `lasting`, and the sentence of each candidate with its
quote for `ownNote` and `private`, written by one function (`noteText`) that
production and the measuring command share. A request holds one text, cut to
1,000 tokens. A capture with several candidates asks about each candidate in a
request of its own, all at the same time. So a capture makes one request for the
message and one for each candidate that passes the structure checks, at most
four in all, and the requests about candidates are at most three open at once
(`MEMORY_CAPTURE_LIMIT`). A name, an id and the conversation are never sent, and
a decision asks for zero retention.

When a decision cannot be made, nothing is stored for the turn and a warning
logs the operation and the gateway's routing facts, never a text. One request
that fails fails all the candidates of the turn. There is no fallback to a
pattern or a list.

Plain code in the memory pipeline reads structure and identity only: that a
quote is in the message, that a sentence has a letter or a digit, that a date is
a date, and that two stored sentences are the same up to case, punctuation and
spacing. It holds no list of words in any language and no comparison that
decides what a learner meant.

### One text to a request

`ownNote` separates the notes better when the model reads one note than when it
reads three, and a message was always asked alone. Measured on 12 October 2026
on the dev deployment, with the 85 notes of the labelled set below, a request
that held one note gave `ownNote` a balance of 0.942 at its best threshold, and
a request that held three gave 0.878. Balance is the mean of the share of yes
texts judged yes and the share of no texts judged no. A decision request cost
$0.0000164 and took 140 to 310 ms (15 messages, same day), so asking alone costs
more requests and no more time:

| How a capture with three candidates asks | Requests | Cost | Time | `ownNote` balance at its best threshold |
| --- | --- | --- | --- | --- |
| All three in one request | 1 | $0.0000164 | one request | 0.878 |
| Each in its own request, at the same time | 3 | $0.0000492 | one request, since they run together | 0.942 |

Most turns propose no candidate or one, and then both ways are the same
request. The three requests run together, so the capture waits for the slowest
of them and not for the sum.

### The labelled set

The thresholds are not taste. They are set from a labelled set of two kinds of
text, each measured the way production asks it, one text to a request.
`test/judgment/message.ts` holds 124 whole messages for `lasting`, in 17
languages and 8 scripts, among them Indonesian, Javanese, Sundanese, English,
German, Arabic, Japanese, Chinese, Hindi and Spanish. About half state
something lasting, and messages that hold private data of a dozen forms,
mixed-language messages and very short messages are in it.
`test/judgment/note.ts` holds 85 notes, each a sentence with its quote, for
`ownNote` and `private`, in the same 17 languages and 8 scripts: sentences in
the learner's own voice, sentences that describe the learner from the outside
(by a word that names them, by a third person, or in another language than the
quote), and sentences that hold private data of a dozen forms, among them a
phone number written with spaces, a street address, an illness, a religion and
a salary. Each carries its expected labels.
`pnpm --filter @repo/backend judgment:measure` runs the set through the dev
deployment that `CONVEX_DEPLOYMENT` names, read from the environment and then
from `packages/backend/.env.local`, and refuses any other, because it spends
model calls: a message for `lasting`, and a note for `ownNote` and `private`,
both in one request, each text a request of its own. It takes no argument. It
prints, for each judgment, the probabilities by label, the counts at the
threshold the deployment reports, the threshold that separates best and the
texts that threshold judges wrongly, by number, language and form and never by
text. It never prints a threshold the deployment did not report. It fails when
a deployment answers a different number of rows than the texts it was sent, and
when two calls of one run are answered with other instructions or another
threshold for a judgment, because the deployment then changed while the command
ran. The thresholds in the catalog follow what it prints, and it runs again
whenever the instructions, the decision model or the set change.

### Measured, and the thresholds

The instructions of `lasting` and `private` were first measured on 15 messages
in seven languages (ADR 0019). The command then ran on the dev deployment on 12
October 2026 with the 124 messages and the 85 notes. The counts are yes judged
yes, no judged yes, yes judged no, and no judged no, and balance is as above.
The rows with three notes to a request are the way that is not used, kept to
show why.

| Judgment | How it was asked | Counts at 0.50 | Balance at 0.50 | Best threshold on this set | Balance there |
| --- | --- | --- | --- | --- | --- |
| `lasting` | one message to a request | 56 / 2 / 0 / 66 | 0.985 | 0.62 | 0.993 (56 / 1 / 0 / 67) |
| `ownNote` | one note to a request | 54 / 12 / 0 / 19 | 0.806 | 0.59 | 0.942 (53 / 3 / 1 / 28) |
| `ownNote` | three notes to a request | 47 / 6 / 7 / 25 | 0.838 | 0.53 | 0.878 (46 / 3 / 8 / 28) |
| `private` | one note to a request | 30 / 0 / 0 / 55 | 1.000 | 0.65 | 1.000 |
| `private` | three notes to a request | 30 / 0 / 0 / 55 | 1.000 | 0.58 | 1.000 |

Where the probabilities lie. `ownNote`, one note to a request: every yes note is
at 0.5 or more (1 in 0.5 to 0.6, 10 in 0.6 to 0.7, 43 above), and the no notes
are spread from 0.2 to 0.8 (19 below 0.5, 9 in 0.5 to 0.6, 3 above). With three
notes to a request the yes notes fall as low as 0.2 (12 of 54 below 0.6).
`private`: every yes note is at 0.8 or more and every no note below 0.5, both
ways. `lasting`: 55 of 56 yes messages are at 0.8 or more and one is in 0.6 to
0.7; 66 of 68 no messages are below 0.5, one is at 0.55 and one at 0.84.

The thresholds, and why each is where it is:

| Judgment | Threshold | Why |
| --- | --- | --- |
| `lasting` | 0.5 | A memory that is missed is lost, and a message judged yes by mistake costs one capture call that then saves nothing. At 0.5 no yes message is missed. |
| `ownNote` | 0.6 | At 0.6, 53 of 54 own notes are kept and 28 of 31 notes that are not the learner's own are dropped. At 0.5, 12 of those 31 are kept. |
| `private` | 0.5 | Every private note is at 0.8 or more and every other note is below 0.5, so 0.5 and the best threshold, 0.65, both separate the set. The lower of the two is the safer, because keeping a private note is the worse mistake. |

The thresholds were chosen on the same set they are measured on, so the numbers
describe this set and are not a forecast of how the judgments do on what
learners write. The command is what to run again when the instructions, the
model or the set change.

### Wordings measured and not adopted

Three other wordings of the `ownNote` instructions were measured the same day,
one note to a request, and none separated the notes better than the
instructions that stay (0.942 at the best threshold). They are recorded so that
nobody tries them again without a new reason.

| Wording | Result |
| --- | --- |
| "written from the learner's own point of view, in the first person or with no subject, and in the same language as the quote; never refers to the learner in the third person" | 0.861 at 0.50 (39 / 0 / 15 / 31); best 0.919 at 0.25. The no notes fall below 0.2, but 15 of 54 yes notes fall below 0.5. |
| The fault instead of the virtue: "describes the learner in the third person, as another person would write about them, or is written in a different language than the quote" | 45 of 54 yes notes below 0.5 and 29 of 31 no notes at 0.5 or more: 0.884. |
| Two questions: "refers to the learner in the third person, as someone else would write about them" and "is written in a different language than the quote" | Third person: all 29 label and pronoun notes at 0.62 or more, and 8 of 54 yes notes at 0.6 or more (two of them English notes whose verb is in the third person, "Prefers worked examples before formulas"). Language: the 2 notes in another language at 0.73 and 0.75, one more no note at 0.64 (an English word in an Indonesian note), every yes note below 0.5. Together 31 of 31 no notes found and 46 of 54 yes notes kept: 0.926. |

## Implementation Contract

- `ninaMemories` (index by user and confirmation time, index by end time)
  replaces the document with a `facts` array, and `ninaMemoryKeys` (index by
  user, key and confirmation time, index by memory) is its index. No table ties
  a memory to a chat, and the chats trigger touches no memory.
- `nina/memory:list`, `state`, `add`, `edit`, `remove`, `restore`, `pause` and
  `clear` are public, pass the session middleware, and act only on the
  signed-in learner.
  `list` is paginated, the most recently confirmed memory first, and holds at
  most 50 memories to a page; a visitor gets an empty page. `state` tells
  whether memory is paused. `add` and `edit` fail with `NinaMemoryRejected` for
  `empty` and `missing`. `empty` means the write holds neither a title nor
  words, and it is checked first, before the memory is read. A title of more
  than 80 characters, or of only spaces, never reaches the function: its
  arguments refuse it. `restore` fails with `NinaMemoryRejected` and `missing`
  (see the restore record below). `read`, `paused`, `known`, `lookup`,
  `capture`, `drain`, `expire` and `purge` are internal. `paused` tells whether
  the learner paused memory, and the capture asks it once, before it sends the
  learner's message to any model and before it reads a memory. `known` reads
  the learner's memory state once more for the moment of the last Delete all,
  and the write reads it again as the authority.
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
- A memory is named by its title, or by its words as the editor shows them. The
  page reads the stored Markdown in
  `@repo/design-system/components/editor/plain`, and no pattern decides what a
  learner wrote: `C++`, `a == b` and `Q&A` are the words, not marks or entities.
  The reader lexes with the `marked` that `@tiptap/markdown` depends on,
  declared as `marked-tiptap` and held with it in the dependency policy,
  because the `marked` of the chat renderer is a later major that reads some
  text differently. Importing the extensions that hold the editor's tokenizers
  would put about 93 kB gzipped (esbuild, minified) into the first JavaScript
  of the page, so the reader and the editor share their grammar instead, and
  the editor is the one that gives way where Tiptap's own grammar is wider than
  Markdown. The reader adds 13,465 bytes gzipped (43,066 raw) to the 68 scripts
  that the Memory route loads, which went from 952,979 to 966,444 bytes
  gzipped in the production build (the browser's resource timing, the same on
  three runs, for a signed-in learner with an empty list). That is under the
  15 kB gzipped that the reader was allowed, and `marked` alone is 12.7 kB
  gzipped of it.

  Tiptap's tokenizer for a numbered list takes one or two letters, or a roman
  numeral, for a number, so `Dr. Budi sakit` opened as a list item `Budi sakit`
  and the next save wrote `1. Budi sakit` (ueberdosis/tiptap issues 8376 and
  8395; the fix merged for 8376 stops mixed-case titles only and is not in
  any release up to 3.32.0). The editor lexes a numbered list with `marked`,
  as it does a bullet list, and the reader does too. Both lex the underline and
  the highlight with the one rule of `marks.ts`: a mark is a pair of delimiters
  around words, so `C++ and C++20` and `a == b == c` are text. A pair with no
  space inside it, `a==b and c==d`, is still a mark, as `**b**` is, and the
  stored text never changes either way.

  The test `plain.test.ts` sets the reader against the editor, with a document
  to parse HTML in as a browser has: for every block and every mark the editor
  writes around the worst-case words, for the ways a line of Markdown can
  start, and for Markdown that Nina may write. That is all it proves. The two
  still read some Markdown another way, and the test names each: raw HTML,
  which the editor parses with the document of the page; a text in which
  Tiptap finds no block, such as a table alone, which it shows as the Markdown
  itself; and a few shapes that Tiptap bends to fit its schema or reads with
  the rule of its own task list, namely a task item with no words between
  other items (the row keeps its check box as `[ ]`), a divider inside a task
  item, an item that starts with a heading or a code block, a code fence
  indented by one to three spaces, and a code span that starts with a task
  marker. Reading never changes the stored text. Words that show nothing, such
  as a divider or a table, are called Untitled. The server and the browser give
  the same name, and the search reads the same words. A situation that had
  ended when the server read the page is not listed, by the rule that search
  and the recall of a turn apply (`hasEnded`), judged at that moment, so no
  clock reaches a query and nothing changes while the learner looks. Each name
  takes the direction of its own words, and a name too long for its row keeps
  its whole text in its title.
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
  and the next close writes them, whatever the memory on the page shows. When
  the learner removes the title and every word of a stored memory and closes
  the editor, nothing is written, because the server keeps the last words it was
  handed: only a confirmed delete removes a memory. A new memory that was never
  given a word creates nothing. A new memory that the learner deletes while its
  first save is on its way has a row from the moment that save goes out, and
  the row leaves the list at once; the memory is deleted when the server has
  stored it. No page offers an Undo: a delete
  asks first, with the design system's `ResponsiveDialog`. The `restore`
  mutation below stays only for an older web build that still calls it during
  the deploy skew window, and it gives back what that build deleted. Words that
  an open editor held and had not saved when the learner deleted the memory were
  never part of it. They open in the editor again only when the server does not
  delete the memory. A paste that would take the Markdown past 2,000 characters is
  refused as a whole, and the page says so. The panel beside the page never
  takes the room the list needs: the list keeps a card of 20rem between its
  padding, whatever width the learner dragged the panel to and whatever the
  window is, and its
  resizer says the width the panel has and the widths it can have. A drag of
  its edge measures from where the page ends and not from the window, so a
  scrollbar never leaves the edge beside the pointer. Nina's sheet, which is
  fixed to the same edge and drags with the same hook, lands its edge the same
  way. Below 65rem the editor is
  the sheet it is on a phone: the sidebar, the smallest panel and the room of
  the list need 63rem, and where scrollbars take room the stable gutter of the
  page on both edges takes a scrollbar's width from each side of the window,
  which the media query does not count, so the 2rem up to 65rem are for them.
  The head of the list shows the word on its add button and the icon of its
  search by its own width, because the card beside the panel is as narrow as
  the card on a phone. Under 24rem the page keeps its scrollbar gutter on one
  edge and not on both (`globals.css`), on every route: the gutter belongs to
  the page, and a gutter that changed with the route would move the page when
  the learner navigates. Where a browser's scrollbars take room, which includes
  the headless Chromium that CI ran (it paints no scrollbar and still reserves the
  gutter), two gutters left a 320px page cards too narrow for the German
  placeholder of the search and for the end date of a situation in a row, and
  the 320px browser tests failed in CI until the page kept one gutter. A phone
  has no gutter and was never short. A search field also keeps a slot for its
  clear button while it is empty, and the placeholder cannot use it, so the
  field hides the button while the placeholder shows and gives it back with the
  first letter. The width of the field less its padding does not show the slot,
  so the browser test reads the placeholder's own box from the shadow tree that
  the browser draws the field from (`e2e/support/placeholder.ts`).
- Every change shows at once on every loaded page and rolls back when it fails.
  A change made before the live list has answered shows when it answers,
  because the browser has no page of its own to change until then. A deleted
  memory leaves the page at once. When the server keeps it, the memory comes
  back, and an editor that was open on it reopens with the words it held.
- `remove` keeps what it deletes for `MEMORY_UNDO`, and `restore` gives it back
  as it was, for a web build from before the Undo toast went. The table
  `ninaMemoryRestores` (index by user and the id the memory had, index by user
  and confirmation time) holds one record for each memory the learner deleted
  whose window has not ended. A record holds every
  stored field of the memory, sealed as stored and never opened (author,
  confirmation time, kind, topics, end day, words and title), the id the memory
  had (`memoryId`), the keys it had in the memory index, and the moment its
  window ends (`expiresAt`). `remove` writes it in the transaction that deletes the
  memory and its keys, and schedules the internal `purge` for that moment, which
  deletes the record if it is still there. The window is `MEMORY_UNDO`, 5
  seconds, in `memory.spec`, and a call that arrives after it answers `missing`.
  `restore({ id })` takes the id the memory had. It fails with
  `NinaMemoryRejected` and `missing` when the learner has no record under it:
  the id is another learner's, the window ended, the memory was put back
  already, or "Delete all" took the memory (it was confirmed at or before the
  moment the learner last deleted every memory, which every reader would hide
  and no batch might delete). A "Delete all" counts the newest record in its
  moment as it counts the newest memory, so a memory deleted before the learner
  asked is refused even when the clock had not moved on since the memory was
  written. Otherwise it inserts the stored fields back as they were, so a
  situation keeps its end day, a memory Nina saved keeps Nina as its author, and
  the memory keeps its confirmation time and so its place in the list. It
  inserts the same key rows, deletes the record, asks for a build of the
  portrait from scratch (the memory returns with a confirmation time older than
  the moment a build reads on from, which such a build would never meet), and
  returns the memory as the Memory page shows it. Only what Convex gives a
  document differs: a new id and a new creation time. Nothing is sealed or
  computed again, and a record is used once. A situation whose end day passed
  meanwhile is put back and then ends as any ended situation does (`hasEnded`):
  the daily job deletes it. No other deletion is taken back: "Delete all", the
  daily expiry and account deletion keep no record, and account deletion deletes
  the learner's records with their memories, before the key goes. A deleted
  memory's words therefore stay on the server, sealed for the learner, for the
  window and until the job that deletes the record at its end has run, and only
  for a memory the learner deleted one at a time (`restore` refuses the record
  from the end of the window, whether or not the job has run). The words stay
  because `add` cannot give a memory back: it takes no kind, no end day and no
  author, so only `restore` gives back a situation with its end day, or a memory
  Nina saved with Nina as its author. The Memory page never calls `restore` now:
  it stays for a web build from before the Undo toast went, until the follow-up
  named at its seam in `memory.impl.ts` deletes it.
- `read` gives a turn the account profile, the portrait when the learner has
  one, and the at most 8 memories that the learner's words and the topics of
  the open page recall. `known` gives the capture call the account profile and
  the at most 12 memories that match the message and the topics of the open
  page. `lookup` gives the memory capability the at most 6 memories that match
  Nina's query. A memory comes with a kind and a title only when it has them,
  and none of them gives a portrait or a memory while memory is paused. `lookup`
  also tells that memory is paused, so the capability can refuse. `known` tells
  the memories best first, and the capture call lists them in that order, so a
  candidate can name one by its place.
- The turn reads the learner's words from the message it answers, one document
  of the Agent component, before it calls `read`, and the account deletion
  cleanup deletes the portrait with the memories, a pass at a time, so a
  portrait that a capture still running asks for is deleted by the next pass.
- `capture` takes the turn, not the chat: it writes only while the turn exists
  and memory is not paused. It takes the topics of the open page and the
  memories the call listed, in the order it listed them, at most 12 (the
  candidate's `known` is a place in that list, counted from 1).
- The turn stores `remembered`, how many memories its capture wrote or
  confirmed. The turn summary carries that count, as it carries the credits and
  the usage, so the answer can link to the Memory page. It holds no words.
- The documents of the old model, one per learner with a `facts` array, are
  deleted before this schema deploys. Convex refuses a schema that a stored
  document does not match, so a deploy that succeeds proves that none is left.
- The old settings card of browser tabs opened before October 2026 called
  `get`, `enable`, `disable` and `forget`, and they were to stay until three
  days had passed without a call. The Memory page replaced that card on
  12 October 2026 and the four functions are deleted without that wait, so a tab
  that still shows the card meets an error on them until the learner reloads it,
  and its "Turn off and forget" button deletes nothing.
- The learner profile derived on read, which ADR 0010 defined, is unchanged.
