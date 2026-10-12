# ADR 0023: Nina Finds Lesson And Quran Sections By Meaning And By Words

## Status

Accepted.

## Context

Nina searched Nakafa content by words, in whole lessons and in the language of
the question. A question had to share words with a lesson to find it, and a
result named the lesson, not the part of it that answers. The corpus is small
enough to embed whole: 1,170 lesson and article documents with 9,567 sections,
and 114 surahs with 1,085 signed chunks of six verses in three languages, 3,255
passages. That is 12,822 rows, and only published lesson and Quran text is
embedded. A learner's messages never are.

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
  section that a release leaves as it was is not written again.
- `contentSectionSources`: one row per document, naming the version its sections
  were made from. The version joins the format of a section, the embedding
  model, and the signed facts of the source: the projection hash and the artifact
  hash of a lesson, the snapshot of the Quran for a surah. It is written in the
  same transaction as the sections, so it never names a version that they lack.
- `contentSectionState`: one record of the last build that finished, with the
  release and the model. Search trusts the index only while it names the active
  release and the model that embeds the questions. Otherwise Nina searches by
  words, as before, and logs one line.

**The build.** `startSectionBuild` schedules it where `advancePublication` sees a
release become active, and `contents/sections/build:run` starts it by hand. A step
reads a bounded page of the active release, embeds in batches of 64 across the
documents of the step, stores each document in one transaction, which also
deletes the rows of sections the document lost, and schedules the next step: the
lessons six at a time, the Quran from the first surah that the index lacks, and
then the clean up. A document whose version the index holds is
passed over without reading its artifact or its sections. A stored section that
matches in text and model keeps its vector and is written only when its place or
heading changed. A section that the model refuses is left out of the index with a
warning. A document that the active release does not publish any more is deleted
with its sections, a bounded number of rows at a time, and the build then writes
its record. Every step is idempotent, so the way to resume is to start again. A
step that fails stops the chain with the failed position in the log, and Nina
searches by words until the next build finishes.

**The search.** `contents/sections/search` embeds the question once, asks the
vector index for the nearest 32 sections of the learner's language and kind, and
`hits.resolve` adds the 32 best matches by words, merges the two lists by
reciprocal rank fusion with k = 60, gives each section in the learner's language
when the document has the same sections there, and keeps those whose document is
still published. Nina's Nakafa search keeps its tool contract and its data parts;
it adds the try-outs that its word search finds, because a try-out has no text to
embed, and it returns the best section of each document with the heading it sits
under, so that the read tool opens the document at that section.

**The model** is provisional. `scripts/knowledge` runs a fixed set of questions
against each embedding model of the gateway and reports how often the right
section is among the first five in each language. The constant follows its result.

## Cost

The documents and bytes that a build and a search read and write, measured with
Convex test metrics and pinned by the tests that are named there, are in
`docs/convex/cost.md`. A build of a release that changed nothing embeds nothing
and writes nothing, and one that changed a section writes that section and the
record of its document.

## Consequences

- A change to how a document is split or how a section's text is made must raise
  `SECTION_FORMAT` in `draft.ts`. Otherwise the next build trusts the versions it
  stored and leaves the old sections in place until their documents change.
- Changing `embeddingModelId` changes every version, so the next build embeds all
  12,822 sections again, and search uses words until it finishes.
- A document may have 128 sections at the most. The longest lesson has 19 and the
  longest surah 48. A longer one fails the build and names itself.
- The Quran is split and embedded again only when its snapshot changes. A build
  that finds it unchanged reads only the records of its 342 documents.
- Raising the number of sections per step or the size of a page is a cost
  decision. Each step of a build that finds nothing changed reads the active
  release once (the state and the release row), so fewer, larger steps read less.
