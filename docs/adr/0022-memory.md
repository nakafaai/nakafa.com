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

Memory is written only when the learner's own words support it. A learner
writes anything, in any language and script, so no list of words and no pattern
decides whether a message states something lasting or holds something private:
a decision model does (see Judgments). The capture model words each statement,
and plain code proves that the learner said something to support it, not that
the statement restates it faithfully. That is why Nina reads the statements as
data, and why the learner can read, edit and delete every one. After a complete
turn:

1. The decision model judges the learner's message `lasting`: whether it states
   something that will still matter in later study sessions, such as their
   grade or level, a goal, how they like to learn, something they find hard, or
   a situation with a date. It is sent that message alone, cut to 1,000 tokens,
   and never a name, an id or the conversation. A message it judges not lasting,
   in any language, makes no capture call, and so does a message of only
   whitespace and the message of a learner who paused memory, which is sent to
   no model at all.
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
   its text does not label the learner, and a situation has an end day of today
   or later. A text labels the learner when it starts with
   a word that names them (Learner, Student, Pupil, User, Siswa, Murid,
   Pelajar, Pembelajar, Pengguna, Lernende, Schüler, Nutzer, Benutzer, with the
   article that may lead it) or holds an English label that the learner's own
   words do not hold. The check drops such a candidate and does not rewrite it,
   because a rewrite could say something the learner did not. Memories saved
   before this rule keep their words until the learner says them again, which
   replaces the words of a memory Nina wrote, or edits them. The candidates
   that stay then go to the decision model, all of them in one request, each as
   its sentence followed by its quote, and it judges each one `private`: whether
   it holds contact details, a home address, an identity or account number, a
   password, or information about health, religion, ethnicity, political views
   or money. A candidate it judges private is dropped.
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
never cancels the title, the suggestions or the summary. A decision that cannot
be made, because the gateway fails or the deadline passes, is such a failure:
nothing is stored for that turn, the capture model is not asked when it was the
first decision that failed, and the warning names the operation (`judge`), the
gateway's reason, status and type, and never the message, a candidate or a
quote. No pattern or list takes the place of the decision model.

A turn starts with at most 8 memories: first those linked to the topics of the
open page, the best first, and then, to fill the places that are left, the most
recently confirmed memories that are not there yet and have not ended. The fill
looks at the 64 most recently confirmed memories, because a situation that has
ended stays stored until the daily job deletes it. The rest of the learner's
memories stay in the store, found by search. They sit in a block that names them
as facts the learner told Nina, never instructions, within the learner block's
token budget. Each memory is one line,
`- (kind) Title: words`, with `(kind) ` left out when it has no kind, the title
and its colon left out when it has no title, and the words and the colon left
out when it has none. Its whitespace is collapsed, so the Markdown of a memory
can never open a new section of the prompt, and its angle brackets are written
as `&lt;` and `&gt;`, so a memory can never close the block it sits in. The
capture call reads each memory with its id, as `- [id] (kind) Title: words`, but
only the first 240 characters of the title and words together, counted by code
point so that a cut never leaves half of an emoji, followed by `...` when they
are longer, so its prompt stays small whatever a learner keeps.

A memory is independent of chats. Deleting a chat deletes no memory, not even
one Nina wrote from that chat. Only three things delete a memory, and each
deletes its key rows with it:

- The learner deletes one memory, or all of them, on the Memory page.
- A daily job deletes the situations whose end day has passed, 25 per call, and
  schedules itself again while a call is full.
- Account deletion removes the learner's memories in bounded batches, before the
  learner's vault key goes. Every pass looks for memories first, so a capture
  still running when the deletion starts is swept by the next pass, and one that
  lands after the key is gone seals nothing, because a deleted account gets no
  new key. The capture write needs no check of its own for a deleted account.

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
its next write or confirmation, because the sync of its keys deletes the keys it
should not have. The temporary internal function `nina/memory/rekey:page`
re-keys the others, 25 memories to a call: it takes the cursor of the call
before, reads the next page of memories, gives each the keys of the current
version from its own words, title and topics, returns how many it looked at and
how many it changed together with the next cursor, and never schedules itself.
The operator runs it on dev and then on production until `done`, and once more
to see that no memory changes. When both show that, the function and its tests
are deleted; the version stays.

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
last for each. When the text has more words than the keys that are left, it
looks up the longest words first, because a word that is frequent in a language
is short in it, in every language. A memory scores 3 for the lesson that is
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
capture call asks for 12 memories, the write for 8 for each candidate, and a
turn start searches by the topics of the page alone. The Memory page does not
use it: its search runs in the browser.

## Judgments

Nina asks every question about a learner's words through one module,
`confect/nina/judgment`. A judgment is an entry of data in its catalog: its
name, the kind of its question (yes or no), the instructions the decision model
reads, and the probability from which its answer counts as yes. The interface of
the module is small: `judge(names, texts)` asks the judgments it names about
each text, all of them in one request to the Convex AI gateway (ADR 0019), and
answers with one record of verdicts for each text, true or false for each name.
A caller never sees a probability, a threshold or a model, and adding a
judgment is adding an entry. The instructions of an entry hold in any language
and name no language, no word and no pattern. Two judgments exist:

- `lasting` decides whether the capture model runs for a message.
- `private` is asked of each candidate the capture model proposes, and a
  candidate it judges private is dropped.

What is sent to the decision model is the least text that answers the question:
the learner's message for `lasting`, and the sentence of each candidate with its
quote for `private`. Each text is cut to 1,000 tokens. When a decision covers
several texts, they go numbered and each question names its text. A name, an id
and the conversation are never sent, and a decision asks for zero retention.

When a decision cannot be made, nothing is stored for the turn and a warning
logs the operation and the gateway's routing facts, never a text. There is no
fallback to a pattern or a list.

The thresholds are not taste. Both start at 0.5, and they are set from a
labelled set: `test/judgment/set.ts` holds 124 short messages written for the
purpose in 17 languages and 8 scripts, among them Indonesian, Javanese,
Sundanese, English, German, Arabic, Japanese, Chinese, Hindi and Spanish. About
half state something lasting and a quarter hold private data of a dozen forms,
among them a phone number written with spaces, a street address, an illness, a
religion and a salary, and mixed-language and very short messages are in it.
Each carries its two expected labels.
`pnpm --filter @repo/backend judgment:measure` runs the set through the
deployment the caller's environment configures (the development deployment
unless it is given `--prod`) and prints, for each judgment, the probabilities by
label, the counts at the held threshold, the threshold that separates best and
the messages the held threshold judges wrongly, by number and never by text. The
thresholds in the catalog follow what it prints, and it runs again whenever
instructions or the decision model change. The first measurements, of 15
messages in seven languages, are in ADR 0019.

Two checks still read words by rule, and neither is a judgment yet: the labels
that name the learner (a list in three languages, step 3 above), and the
comparison of two sentences for whether they say the same, which splits words at
spaces.

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
  arguments refuse it. `read`, `paused`, `known`, `capture`, `drain` and
  `expire` are internal. `paused` tells whether the learner paused memory, and
  the capture asks it before it sends the learner's message to any model and
  before it searches a memory.
- `clear` stores the moment the learner asked, as `ninaMemoryClearedAt` on
  their learning preference, and in the same transaction deletes a batch of 25
  memories with their keys. `drain` deletes the next batch, again and again,
  until none is left, so one transaction never deletes more than 25 memories and
  2,625 documents. `clear` returns at once. The batches delete the memories
  confirmed up to that moment, so a memory the learner or Nina writes while they
  still run stays. The daily expiry deletes a batch of 25 ended situations the
  same way.
- From the moment `clear` stores it, every reader drops the memories confirmed
  at or before it, on every device and for Nina's next turn, though the batches
  may still hold them. Without that, the list would show the rest again once
  the page stopped hiding them, another device would show them, and the next
  turn could still use them. The readers are `list`, `read`, `known`, the search
  they and the capture write use, and the capture write's lookups by id, which
  count such a memory as gone, so a chat never confirms and brings back what the
  learner deleted. `edit` refuses such a memory as missing for the same reason.
  A reader that takes the newest first only drops the tail: the search, the
  fill of a turn start and the keys read memories above that moment in their
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
- `read` gives a turn the account profile and the at most 8 memories it starts
  with, for the topics of the open page. `known` gives the capture call the
  account profile and the at most 12 memories that match the message and the
  topics of the open page. Both give a kind and a title only for a memory that
  has them, and no memory while memory is paused.
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
