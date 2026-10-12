# ADR 0023: Nina Finds Lesson And Quran Sections By Meaning And By Words

## Status

Accepted.

## Context

Nina searched Nakafa content by words, in whole lessons and in the language of
the question. A question had to share words with a lesson to find it, and a
result named the lesson, not the part of it that answers. The corpus is small
enough to embed whole: 1,170 lesson and article documents with 9,567 sections,
and 114 surahs with 1,085 signed chunks of six verses in three languages, 3,255
passages. That is 12,822 rows, and the index holds and embeds only published
lesson and Quran text. No stored learner message is ever embedded. A search
embeds one thing from a learner: the short search phrase that the specialist
writes from a question, which it compares with the sections and keeps nowhere.
That request cannot carry the zero retention flags that every language model
call sends (ADR 0019), so it relies on the statement of the gateway.

## Decision

**A derived read model.** Three tables hold the section index, and none of them
is a source of truth: deleting them makes the next build make them again from
the active release, which the strict signed readers give. The index changes
nothing about how a release is accepted, activated, verified, compacted, or
rolled back.

- `contentSections`: one row per section. A lesson or article splits at its
  level-two and level-three headings, with the part before the first heading as
  the section `top`. A surah gives one passage per signed chunk and language. A
  row holds the identity of its document and its language, its place (`ordinal`
  among `count`, the same in every language), its anchor and heading path, the
  text for word search (at most 12,000 characters), the hash of that text, a
  vector of 768 numbers made by the model named in `gateway/model.ts` from the
  first 4,000 characters, and a `scope` of the form `id:material` that the
  vector filter tests. A row does not say which release made it, because a
  section that a release leaves as it was is not written again, and a row is
  found by its language, its document, and its ordinal, not by its anchor, so a
  renamed heading changes its row in place instead of leaving a second one.
- `contentSectionSources`: one row per document, naming the version its sections
  were made from. The version joins the format of a section, the embedding
  model, and the signed facts of the source: the projection hash and the artifact
  hash of a lesson, the snapshot of the Quran for a surah. It is written in the
  same transaction as the sections, so it never names a version that they lack.
- `contentSectionState`: one record of the last build that finished, with the
  release and the model. Search trusts the index only while it names the active
  release and the model that embeds the questions. Otherwise Nina searches by
  words, as before, and logs one line.

**The build.** `startSectionBuild` schedules it in the transaction that makes a
release active, from the handlers of `activate.activate` and
`activate.activateRecovery`, so an activation that commits always has its build
queued and a repeated activation queues nothing; `activateCandidate` and
`activateRecovery` themselves are as they were. `contents/sections/build:run`
starts it by hand, which is also how the release that is active when this ships
gets its first build. A step reads a bounded page of the active release, asks
for each document which of its texts the index holds, embeds the others in
batches of 64 across the documents of the step, stores each document in one
transaction, which also deletes the rows of sections the document lost, and
schedules the next step: the lessons six at a time, the Quran from the first
surah that the index lacks, and then the clean up. A document whose version the
index holds is passed over without reading its artifact or its sections. A
stored section of the document with the same text and model gives its vector to
the section that has that text now, wherever it stands, and a row is written
again only when something about it changed, such as its place, the number of
sections of its document, or its heading. A section that the model refuses is
left out of the index with a warning. A document that the active release does
not publish any more is deleted whole, its rows and its record in one
transaction, up to 128 rows in a call, so that a record never names a version
that some of its sections lack; a call stops before a document that does not fit
what is left of its rows, and the build then writes its record. Every step is
idempotent, so the way to resume is to start again. A step that fails stops the
chain with the failed position in the log, and Nina searches by words until the
next build finishes.

**The search.** `contents/sections/search` first asks `state.ready` whether the
index may answer, and gives no answer, without embedding the question, while it
may not. Then it embeds the question once, asks the vector index for the nearest
32 sections of the learner's language and kind, and `hits.resolve` adds the 32
best matches by words, merges the two lists by reciprocal rank fusion with
k = 60, gives each section in the learner's language when the document has the
same sections there, and keeps those whose document is still published. Nina's
Nakafa search keeps its tool contract and its data parts; it adds the try-outs
that its word search finds, because a try-out has no text to embed, and it
returns the best section of each document with the heading it sits under, so
that the read tool opens the document at that section.

**The model** is provisional. `scripts/knowledge` runs a fixed set of questions
against each embedding model of the gateway and reports how often the right
section is among the first five in each language. It embeds the stored sections
as the build does: a section that a model refuses is counted and ranks last, as
a build with that model would leave it out of the index. The test costs money
and minutes, so it runs only on the dev deployment of the checkout, through the
Convex CLI and behind the same deployment check as the release gate. The
constant follows its result.

## Cost

The documents that a build and a search read and write are measured with Convex
test metrics and pinned by the tests that are named in `docs/convex/cost.md`,
which also gives the bytes of the same runs and the cost of the whole corpus,
each figure said to be measured, counted, or computed. A build of a release that
changed nothing embeds nothing
and writes only the record of the build, and one that changed a section embeds
its new text and writes that section, the record of its document, and the record
of the build.

## Consequences

- A change to how a document is split or how a section's text is made must raise
  `SECTION_FORMAT` in `draft.ts`. Otherwise the next build trusts the versions it
  stored and leaves the old sections in place until their documents change.
- Changing `embeddingModelId` changes every version, so the next build embeds all
  12,822 sections again, and search uses words until it finishes.
- A document may have 128 sections at the most. The longest lesson has 19 and the
  longest surah 48. A longer one fails the build and names itself, and so does a
  clean up that finds a stored document with more rows than that, because it
  could not delete the document whole.
- The Quran is split and embedded again only when its snapshot changes. A build
  that finds it unchanged reads only the records of its 342 documents.
- Raising the number of sections per step or the size of a page is a cost
  decision. Each step of a build that finds nothing changed reads the active
  release once (the state and the release row), so fewer, larger steps read less.
