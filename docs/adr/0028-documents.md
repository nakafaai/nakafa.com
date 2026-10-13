# ADR 0028: Collaborative Documents Sync Their Own ProseMirror Steps, And One Module Owns Files

## Status

Accepted on 13 October 2026 with owner decisions K1, K10, K12, and K16. The owner
approved decisions K1 to K20 on that day. The editor module, `confect/editor`,
and the Files module, `confect/files`, are planned for program wave B (ADR 0013
describes the waves). Neither module nor the import exists yet. The repository
installs none of `prosemirror-collab`, `mathlive`, and `@convex-dev/presence`.

## Context

The design system has one Tiptap editor, in
`packages/design-system/components/editor`, which the Memory page uses. It reads
and writes Markdown for one author, and Tiptap is pinned at 3.31.4 in
`packages/design-system/package.json`. A school needs more. Teachers write
questions together in real time, with formulas, images, a reading passage that
several questions share, and rubrics. Announcements are composed in the same
editor. The preview uses the renderer that students see (ADR 0018).

Convex sets the bounds (`docs.convex.dev/production/state/limits`, read on 13
October 2026). A document holds 1 MiB and nests 16 levels. A transaction reads
at most 16 MiB and scans at most 32,000 documents. ProseMirror JSON can nest
deeper than 16 levels, because every node adds two: the node and its `content`
array (ADR 0031).

Files have two owners today. Nina's uploads are in
`packages/backend/confect/nina/uploads.*` and the `ninaUploads` table, and the
Agent component keeps the files of messages. The first School's forum has
attachments of its own, which K11 retires. A daily job, `internal.storage.sweep`
in `packages/backend/confect/storage.impl.ts`, retires the Agent files that
nothing refers to.

## Decision

### One document model

- The source of a document is ProseMirror JSON. For a question it is the
  assessment document of ADR 0031: typed JSON from the Aksara contract, stored as
  JSON text in a string field, with a node depth of at most 16. Tiptap edits one
  node for each node of the document. Markdown is not the source, because step
  sync works on ProseMirror steps.
- `confect/editor` serves questions, materials, and announcements. Nina's memory
  is not one of its users. The Memory page keeps its own editor: Markdown, one
  author, sealed with the learner's key.
- A draft is an editor document. Publishing a question to the bank, which ADR
  0031 calls a teacher's save, validates the document against the contract and
  writes an item version, which never changes after it is used. Nothing else
  writes an item version: a draft writes steps and snapshots. Publishing is an
  audited change (ADR 0016). The steps of a draft are not, because a draft is its
  own record.
- The server validates every snapshot and every published document with the
  Schema of the contract. `Node.fromJSON` of prosemirror-model 1.25.12 does not
  check content, and `Node.check()` does, so a document that parses is not a
  document that is valid.
- An announcement is owned by its class post (ADR 0025). The document records
  steps only while the announcement is composed.

### Own step sync on prosemirror-collab 1.3.1

The server is the authority. A client keeps its base version and its unconfirmed
steps with the `collab` plugin of `prosemirror-collab`. It sends its steps with
its base version, and one mutation checks the version and appends the steps, so
two clients never win the same version. A version counts steps, so a batch of
three steps moves it by three.

| Order | Event | Result |
| --- | --- | --- |
| 1 | Hendra sends a step at version 40 | Accepted. The document is at version 41. |
| 2 | Rina sends a step at version 40 | Refused, because her version is stale. |
| 3 | Rina fetches the step of Hendra | She rebases her unsent steps on the client. |
| 4 | Rina sends again at version 41 | Accepted. The document is at version 42. |

`prosemirror-collab` is not part of `@tiptap/pm` 3.31.4 (`pnpm-lock.yaml`). It
is added next to the Tiptap packages of `packages/design-system`, pinned like
them. It is MIT, depends on `prosemirror-state` alone, and its last release is
1.3.1 of 17 May 2023 (npm).

| Choice | Fits the Confect pipeline | Writers and presence | Upkeep | Decision |
| --- | --- | --- | --- | --- |
| `@convex-dev/prosemirror-sync` 0.2.7 | No. Its entry points are plain Convex functions with tables of their own, outside the session middleware, `decide`, and the journal. | Its README lists documents above 1 MB and syncing presence as missing features that are not planned. | Published on 2 October 2026. Most human commits come from one person (npm and GitHub, read on 13 October 2026). | Not used |
| Own sync on `prosemirror-collab` 1.3.1 | Yes: Confect functions, the session middleware, `decide`, the journal, and deletion. | Each step records who sent it. Presence comes from `@convex-dev/presence` 0.4.0. | A small MIT package whose maintainer wrote ProseMirror. | Used |
| Yjs through `y-convex` 1.0.1 | No. It sends binary updates, and it is an unofficial package of one maintainer. | We would build both. | Unofficial | Not used |
| One writer at a time | Yes | One writer. Presence still comes from the component. | Our code, the smallest | Not used. The owner asked for real-time collaboration. |

The editor is Tiptap 3.31.4. `@convex-dev/prosemirror-sync` accepts this version
(its peer range for `@tiptap/core` is `^2.7.0 || ^3.10.7`), and the decision
stays the same.

Presence is one mechanism for the editor and for proctored sittings: the
`@convex-dev/presence` component at 0.4.0 (ADR 0013). No presence table is
written by hand.

### Bounds

ADR 0031 sets the bounds of the assessment document: a node depth of 16, and the
complete row under 1 MiB. A document is JSON text in one string field, in a
snapshot as in an item version, so one layout and one check serve both. Each
value below is a Convex limit, a bound of ADR 0031, a target, or a computation,
as the last column says.

| Bound | Value | Basis |
| --- | --- | --- |
| A Convex document | 1 MiB, nested 16 levels | Convex limits page, read on 13 October 2026 |
| The content of a document | JSON text in one string field, not an object | ProseMirror can nest deeper than Convex allows |
| A document as a whole | A node depth of at most 16, and the complete row under 1 MiB | ADR 0031 |
| Steps sent in one call | At most 128 KiB and 200 steps | Target |
| Steps read in one call | At most 512 KiB | Target. 100 rows of nearly 1 MiB would pass the 16 MiB a transaction may read. |
| Snapshots | At most one every 30 seconds, when the editor is idle | Target. 200 KiB after 50 pauses an hour is about 10 MB for each document an hour (computed). |
| An image file | At most 2 MB, with alternative text required | Target |
| Presence | A heartbeat every 10 seconds and a limit of 25 seconds | Target. Three editors write about 1,080 times an hour (computed). |
| Cursors | None in the first version | Three editors at one update a second would write about 10,800 times an hour for each document (computed). |

The size is checked where a whole document is written. A snapshot and the save to
the bank each refuse a document whose complete row would pass 1 MiB, before the
write (ADR 0031). A step carries no whole document, so a draft that grows past
the limit is refused at its next snapshot and never reaches the bank.

The step log is bounded too. A scheduled sweep deletes, in bounded batches, the
steps that a snapshot covers, after a delay that the build sets by test. A client
that is behind the oldest step that is kept loads the snapshot and continues
from it.

Acceptance: in `convex-test`, a submit at a stale version is refused, a document
nested 20 levels deep is stored and read back, and a snapshot whose complete row
would pass 1 MiB is refused and writes nothing. In Playwright, three editors work
on one question and no step is lost, and the one renderer of ADR 0018 draws a
Nakafa question and a school question.

### The formula node

The formula is Nakafa's own Tiptap node, with KaTeX 0.19 to draw it and MathLive
to type it. It is not a community formula extension (K16). The node stores
LaTeX once, as the contract of ADR 0031 says, and MathML is rendered from it.

- KaTeX is 0.19.0 in `pnpm-lock.yaml`, and `pnpm-workspace.yaml` forces 0.19.0 on
  `mermaid` and on `micromark-extension-math`. Program wave A tests Mermaid and
  the math of the content under that override before a school formula depends
  on it.
- MathLive 0.111.1 (MIT) is not installed. The editor build installs it. It
  loads on intent, with `next/dynamic` or `import()`, so it never enters the
  first JavaScript of a route (AGENTS.md).

### Who owns a question

A teacher's question is school data (K1). ADR 0031 decides its model and its
rows. This table says what differs from a Nakafa question.

| | A Nakafa question | A teacher's question (K1) |
| --- | --- | --- |
| Owner | Aksara, in a signed release | The school. It is not in the Nakafa catalogue, it is not shared with another school, and it is not used to calibrate a national scale unless the school chooses it for an exam (K12). When the school leaves, it is exported and then deleted by its retention (K10). |
| Stored as | A frozen reference: the content hash, the placement, and the delivery class (`ContentDeliveryClassSchema` in `@nakafa/aksara-contracts/delivery`: public, authenticated, or entitled) | School data in the school's own cell, not signed, with the contract version in each row |
| Language | The language of each part, set by Aksara | One of `id`, `en`, or `de` for each question. It sets the decimal comma or point and the language of the Jev verdict, apart from the interface language. |
| Reading passage | A shared entity from Aksara: identifier, document, image, and language | A shared entity that the school owns. Editing the passage edits every question that uses it, and questions with one identifier show one passage. |
| Starting difficulty | The editorial blueprint: cognitive level, domain, and topic | The teacher's difficulty on a versioned scale, or the blueprint. A question with neither does not enter IRT calibration. |
| Explanation | A Pro right. An enrolled student has Pro while enrolled (K9). | The teacher's, released by the teacher |

AGENTS.md says that Aksara exclusively owns authored content and that no second
authored source is added. A teacher's question is school data and not authored
content in that sense, and one sentence in AGENTS.md says so before the first
school (planned; this change does not write it).

### Import from a PDF and from Google Forms

The import turns a teacher's file into questions that the teacher reviews. It
never publishes one.

- The browser uploads the file straight to Convex storage through an upload URL,
  not through the Vercel server. The Files module scans it first.
- A model reads a PDF as a file part through the Convex gateway (ADR 0019). A
  request carries its documents in the body, which the gateway accepts up to 16
  MiB, and the adapter inlines a PDF as base64, which adds a third. One request
  therefore carries about 12 MiB of PDF at most (16 MiB divided by 4/3). Nina
  keeps the documents of one message to 10 MiB to leave room for the rest of the
  body (`NINA_DOCUMENT_SIZE` in `packages/backend/client/nina/uploads.ts`). The
  target below allows 20 MB for an import, so a larger file is read in page
  ranges, and every request stays within the limit.
- The teacher always sees the extracted questions next to the original page, at
  `harapan.nakafa.com/bank/impor/pts-matematika` (ADR 0026), and nothing is
  applied before the review. The answer key inside the PDF is an automatic
  comparison for the reviewer.
- A question without an answer key is flagged and cannot be published until the
  teacher fills in the key.
- Google Forms follows the connectors (ADR 0015). A form without an answer key is
  flagged in the same way.
- Not in the first version: bulk import of Word documents or spreadsheets, and
  pasting LaTeX or MathML.

The accuracy gate (risk R8 of the School blueprint): the import is not released
before a run on the test corpus meets both targets.

| Measure | Value and basis |
| --- | --- |
| Match with the answer key in the PDF | At least 98 percent. Target. |
| Number and kind of questions | 100 percent. Target. |
| Test corpus | 70 try-out PDFs from the owner's Drive, 10 sets of 7 subtests. They are fixtures only, and no school gives access (owner decision of 30 September 2026). |
| File | At most 20 MB and 30 pages for each import. Target. |
| Scan | The real type of the file, scripts, and malware, before a model reads it. The scanner and the PDF page viewer are not chosen yet. |
| Accuracy and latency of the model | Not measured. They are measured on the same corpus. |
| Cost of extraction | About US$0.03 for 20 pages. It is an estimate from an earlier revision of the School blueprint, not a measurement. |

### Files

The Files module owns every upload, scan, access, and expiry. It replaces the
upload path of Nina (`ninaUploads` and `nina/uploads.*`) and takes the
attachments of the school, so one module owns the rules below. `fileRecords`
(planned) holds the metadata. The upload and the scan are actions, and the
metadata is written by mutations. The storage is Convex storage, and Google
Drive copies come through the Drive connector (ADR 0015).

- The name of a file is sealed with the key of its owner: the school key for a
  school file (ADR 0030), and the learner's key for a Nina attachment (ADR 0024).
  The bytes of a file are not sealed, as ADR 0024 says of Nina's attachments.
- `access` checks permission through the kind that owns the file before it hands
  out the address of the file. A storage address works for anyone who holds it
  until the file is deleted (ADR 0001 records this for Convex file storage), so
  the module never stores or logs one, and deleting a file revokes its address.
- A file has limits in bytes for each file and for each school. The plan sets the
  numbers, and none is chosen here. A large video is a link and not an upload.
- A Nina attachment keeps the retention of ADR 0024. A file uploaded for an
  import (a PDF, a photo, or a Dapodik XLSX) is deleted when the import ends
  (K10). The images that a question keeps stay with it. Any other school file
  stays until its owner deletes it, until its class is deleted, or until the
  school leaves.
- `expire` owns expiry. The daily `internal.storage.sweep` and any expiry of
  school files sit in this module.
- A model or a person reads a file only after it has been scanned.

## What Stays Open

- The scanner, the PDF page viewer, and the library that cuts a large PDF into
  page ranges. `pdfjs-dist` is the candidate for the viewer.
- Whether a kind of file, such as the photo of an exam answer, needs an
  authenticated route instead of a storage address. It is decided when that kind
  is built, and the limit above holds until then.
- The delay of the step sweep and the byte limits of the Files module, which a
  test and the plan set.

## Consequences

- A teacher who edits a question sees who else is editing, and a stale write is
  never lost: the client rebases it.
- A document is text under 1 MiB, so the nesting limit of Convex never applies
  to it.
- Presence and snapshots write all the time while teachers edit. The writes are
  the computations above, and the build measures the documents they read in
  `convex-test` and not on production.
- A reader sees a storage address as long as it holds one. This is the same
  limit as in ADR 0001, accepted there on 12 October 2026 for chat attachments.
- The import does not exist for a school until the gate is met. A teacher
  creates questions by hand until then.

## Rejected Alternatives

- `@convex-dev/prosemirror-sync`, for the reasons in the table.
- Yjs, because it needs a binary protocol that Confect cannot see.
- A document stored as a nested Convex value. Convex refuses nesting beyond 16
  levels.
- Markdown as the source of a question. Steps work on the ProseMirror document.
- A community formula extension (K16).
- Reading a whole large PDF in one request. The gateway body would exceed 16
  MiB.

## Implementation Status

| Part | Status |
| --- | --- |
| The Memory page editor in `packages/design-system/components/editor` (Markdown, one author) | Live |
| Tiptap 3.31.4 and KaTeX 0.19.0 | Live |
| `prosemirror-collab`, `mathlive`, and `@convex-dev/presence` | Not installed. Planned for program wave B. |
| `confect/editor` and its tables `editorDocuments`, `editorSteps`, and `editorSnapshots` | Planned, program wave B |
| The formula node | Planned, program wave B |
| Mermaid and content math under the forced KaTeX 0.19.0 | To be tested in program wave A |
| `confect/files` and `fileRecords` | Planned, program wave B |
| `ninaUploads` and `nina/uploads.*` | Live, replaced by `confect/files` |
| The import from a PDF | Planned. It waits for the accuracy gate. |
| The import from Google Forms | Planned, with the connectors (ADR 0015) |
| The sentence in AGENTS.md about teacher questions | Not written |
