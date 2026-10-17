# ADR 0028: Collaborative Documents Sync Their Own ProseMirror Steps, And One Module Owns Files

## Status

Accepted on 13 October 2026 with owner decisions K1, K10, K12, and K16. The owner
approved decisions K1 to K20 on that day. The pure core of `confect/editor` (the
document, step, batch, and stored-step schemas, the storage form, the version
rule, the size bounds, and the snapshot rule) is in code, with no database
access. The sync slice of 16 October 2026 adds the tables, the functions that
open, read, and submit a document, the server fold that writes its snapshot
(`confect/editor/fold.ts`), the `document` access kind, the step log and its
sweep, the editor-session records, the deletion of a document, and the client
engine. No client writes a snapshot, so the public snapshot write of the earlier
sync slice is removed (see The server folds the log). None of them is live yet:
the question editor of the School host is the first caller, in a later lane. The
import into live code and the Files module, `confect/files`, are planned for
program wave B (ADR 0013 describes the waves). The repository installs
`prosemirror-collab` 1.3.1, and it installs none of `mathlive` and
`@convex-dev/presence`.

The amendment of 17 October 2026 changes the submit, which checks the document that a batch makes before it writes, and the fold, which writes once for a backlog of at most one read and one batch. It also changes the limits of a batch and of a fold (Bounds), and the editor's schema, which the server derives from `packages/editor` instead of a second copy. The amendment is in The server folds the log, Bounds, and Implementation Status.

## Context

The design system has one Tiptap editor, in
`packages/design-system/components/editor`, which the Memory page uses. It reads
and writes Markdown for one author, and Tiptap is pinned at 3.32.0 in
`packages/design-system/package.json`. A school needs more. Teachers write
questions together in real time, with formulas, images, a reading passage that
several questions share, and rubrics. Announcements are composed in the same
editor. The preview uses the renderer that students see (ADR 0018).

Convex sets the bounds (`docs.convex.dev/production/state/limits`, read on 13
October 2026). A document holds 1 MiB and nests 16 levels, and a ProseMirror
node takes two of them: the node and its `content` array (ADR 0031). A
transaction reads at most 16 MiB and scans at most 32,000 documents. A document
16 nodes deep is therefore deeper than Convex allows as nested values, so it is
stored as JSON text (see Bounds).

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

`prosemirror-collab` is not part of `@tiptap/pm` 3.32.0 (`pnpm-lock.yaml`). It
is added next to the Tiptap packages of `packages/design-system`, pinned like
them. It is MIT, depends on `prosemirror-state` alone, and its last release is
1.3.1 of 17 May 2023 (npm).

| Choice | Fits the Confect pipeline | Writers and presence | Upkeep | Decision |
| --- | --- | --- | --- | --- |
| `@convex-dev/prosemirror-sync` 0.2.7 | No. Its entry points are plain Convex functions with tables of their own, outside the session middleware, `decide`, and the journal. | Its README lists documents above 1 MB and syncing presence as missing features that are not planned. | Published on 2 October 2026. Most human commits come from one person (npm and GitHub, read on 13 October 2026). | Not used |
| Own sync on `prosemirror-collab` 1.3.1 | Yes: Confect functions, the session middleware, `decide`, the journal, and deletion. | Each step records who sent it. Presence comes from `@convex-dev/presence` 0.4.0. | A small MIT package whose maintainer wrote ProseMirror. | Used |
| Yjs through `y-convex` 1.0.1 | No. It sends binary updates, and it is an unofficial package of one maintainer. | We would build both. | Unofficial | Not used |
| One writer at a time | Yes | One writer. Presence still comes from the component. | Our code, the smallest | Not used. The owner asked for real-time collaboration. |

The editor is Tiptap 3.32.0. `@convex-dev/prosemirror-sync` accepts this version
(its peer range for `@tiptap/core` is `^2.7.0 || ^3.10.7`), and the decision
stays the same.

Presence is one mechanism for the editor and for proctored sittings: the
`@convex-dev/presence` component at 0.4.0 (ADR 0013). No presence table is
written by hand.

Each editor session has one record in `editorClients`: the account that owns
it, the last batch the server accepted from it, and the version that batch
produced. A batch carries an id that the client makes for it, and a repeat of an
accepted batch writes nothing and answers that version, so a retried call is
idempotent. A session id that belongs to another account is refused with
`ClientTaken`, and the server writes nothing. The record stays until its document
is deleted.

A client that the log no longer serves from its version gets `behind`, and it
opens again from the snapshot. If its record shows that its in-flight batch
landed, that batch's steps are confirmed and dropped. Its other unconfirmed steps
are replayed onto the snapshot as unconfirmed steps of its version, and the
server's steps after the snapshot rebase them. A replayed step that does not apply
is dropped, and so is a step that the rebase cannot map. The editor reports the
count of dropped steps once. The records are kept until the document is deleted,
so the record answers every such client (What Stays Open records the cost).

Every editor applies the server's steps to its own copy of the server's document,
in order. A stored step that does not apply to that document is skipped by every
editor the same way: the editor passes on a step that changes nothing in its place,
so the version still counts it, and it logs one warning. The server's fold of the
log applies the same skip, so the snapshot is the document after the skip, and no
editor writes a snapshot. A stored step is skipped in the same way
when the document it makes nests past `MAX_DOCUMENT_DEPTH` of the contract, so no
editor holds a document that no snapshot can save. An editor whose own step the
server skips cannot keep that step's effect, so it opens again from the snapshot,
where its landed batch is dropped, and the step counts as dropped. The server refuses a batch whose step nests the document past the bound (see The server folds the log), so the depth skip applies to stored steps that predate that refusal, and a step that does not apply is stored and skipped.

An editor refuses an edit that would nest its document deeper than the bound of
the contract. `depthGuard` in `packages/design-system/components/editor/depth.ts`
does that for the caller's bound, and it lets through a change that another
editor's steps brought in, because the server's document is the one that counts.
`stepSizeGuard` in `packages/design-system/components/editor/size.ts` refuses an
edit with a step whose JSON text is over the caller's bound, which the question
editor passes as `MAX_STEP_BYTES` (`confect/editor/batch.ts`). That is the largest
step text one call carries, so the editor holds no edit that no call can send. A
queued step that no call can carry is dropped and counted by the sync
(`dropUnsendable` in `apps/www/lib/editor/replay.ts`). The sync checks each queued step with the contract before it sends it, so a step the contract refuses is dropped and counted the same way (`apps/www/lib/editor/send.ts`). `documentSizeGuard` in
`packages/design-system/components/editor/size.ts` refuses an edit that grows the
document past `MAX_DOCUMENT_BYTES`, measured as the snapshot measures it: the UTF-8
length of the document's JSON text. It measures a transaction only when the
transaction can grow the document, so a transaction that only removes content, or
removes a mark of one node, passes unmeasured. A mark removed from a range is
measured: when the range ends inside a text node, ProseMirror splits the node, and
the parts serialize to more text than the node did.

### The server folds the log

The server writes the snapshot, and no client does. A submit applies its batch to the document as the server knows it, the snapshot with the steps it lacks, with the same model and the same contract check that the fold uses, before it writes a step (ADR 0028). It reads the snapshot and those steps in one read of `FOLD_STEP_LIMIT` steps (`confect/editor/steps.impl.ts`, `confect/editor/result.ts`). A result that the contract refuses fails with `DocumentInvalid` or `DocumentTooLarge`, and the batch writes nothing. A backlog that one read does not hold fails with `FoldPending`, and the client sends the batch again. A batch step that nests the document past `MAX_DOCUMENT_DEPTH` is refused the same way, with `DocumentInvalid`, so the log holds no step that every editor would skip for its depth. A step that the schema cannot read, or that ProseMirror does not apply, is stored and skipped as every editor skips it (the skip rule below). The fold applies the same steps to the same snapshot, so the document it writes is the one the submit checked, and no fold can stall on a batch that the submit accepted.

A submit that brings the steps the snapshot lacks to `FOLD_STEP_LIMIT` steps, or to `FOLD_BYTE_LIMIT` bytes of text, schedules `internal.editor.fold.fold` (`confect/editor/fold.ts` and `fold.impl.ts`). The fold reads every step the snapshot lacks with one `take` of the backlog, at most `FOLD_STEP_LIMIT` steps and one batch of `MAX_BATCH_STEPS` steps, applies them in order with the ProseMirror model of the assessment document (`confect/editor/model.ts`), checks the result the way a snapshot is checked (`storedDocument`: depth, types, and `MAX_DOCUMENT_BYTES`), and replaces the snapshot and its version in one transaction. It writes once, at the head, so no intermediate state is written or checked, and it does not schedule another fold. The sweep, `internal.editor.prune.sweep`, schedules a fold for each document whose steps the snapshot lacks, so a fold that did not run is scheduled within one sweep.

The limits are measured in Bounds. The backlog that a fold applies is at most `FOLD_STEP_LIMIT` steps and one batch: a submit accepts a batch only on a backlog that one read holds (`FoldPending` refuses the rest), and a fold is due when the backlog reaches the limit. A near-bound document writes a snapshot of up to 1 MiB per fold, so at the limit a fold costs about 43 KiB of snapshot write per step (computed: 1 MiB divided by 24). The sweep, `internal.editor.prune.sweep`, runs every ten minutes, and it deletes only the steps that a snapshot covers.

The model is the editor's schema. `assessmentModel` is `documentSchema` of `@repo/editor/document` with the rules of the contract (`ASSESSMENT_RULES` in `confect/editor/model.ts`), and the editor builds its schema with the same function, so each node and mark spec is written once. The backend declares the Tiptap packages its bundle imports, because the Convex bundle resolves each bare import from the backend folder.

The fold and every editor call one rule, `applyStoredStep` in `confect/editor/apply.ts`, so the skip is written once. The fold skips a stored step the way every editor does (the skip rule of ADR 0028): the schema cannot read the step, ProseMirror does not apply it, or the document it makes nests past `MAX_DOCUMENT_DEPTH`. An editor used to fail its sync on a step the schema could not read, while the fold skipped it, so the two disagreed. The sync skips such a step now, as the fold does. The version still counts the step. The skip is logged at error level with its document, its version, and its kind (the step's type), and not its text, because the text is the learner's content. An earlier draft of this rule (editorsync5) failed the fold on such a step. The owner decided the skip, as the editors do, because a failing fold keeps a snapshot that no editor shares and stalls the log for every editor. A step that the contract refuses is not skipped: the fold writes nothing, and it fails with the contract's refusal. A submit prevents that refusal, so only a stored step that predates the check reaches it, and the fold tests plant such a step. The public snapshot write, `editor/snapshots:save`, and the client's snapshot rule (`snapshotDue`) are removed. No page imports the editor client, and the functions are not live (see Status), so no compatibility path is kept for the write.

The client sends its steps only (`apps/www/lib/editor/send.ts`). A batch that the server refuses with `DocumentInvalid` or `DocumentTooLarge` is halved under a new id and sent again, and a batch of one step drops that step and counts it (`SyncDropped`). A batch step that nests the document past the bound is refused this way too. A batch that waits for a fold fails the round, and the next round sends the same batch under the same id.

### Bounds

ADR 0031 sets the bounds of the assessment document: a node depth of 16, and the
complete row under 1 MiB. A document is JSON text in one string field, in a
snapshot as in an item version, so one layout and one check serve both. Each
value below is a Convex limit, a bound of ADR 0031, a target, or a computation,
as the last column says.

| Bound | Value | Basis |
| --- | --- | --- |
| A Convex document | 1 MiB, nested 16 levels | Convex limits page, read on 13 October 2026 |
| The content of a document | JSON text in one string field, not an object. Its UTF-8 bytes are checked before the write, and at most `MAX_DOCUMENT_BYTES` (`confect/editor/size.ts`). | The largest text whose snapshot row, with its time, its version, and its document ID, stays below 1 MiB by Convex's size function (`getDocumentSize`). The document ID is taken at 32 characters, the estimate that `convex` uses for an `_id`. ProseMirror can nest deeper than Convex allows. |
| A document as a whole | A node depth of at most 16, counted as `MAX_DOCUMENT_DEPTH` counts it: the `doc` node is level 1 and each node below it is one level, while its `content` array is not. The complete row stays under 1 MiB. | ADR 0031, and `MAX_DOCUMENT_DEPTH` of `@nakafa/aksara-contracts` 0.49.0 (`confect/editor/node.ts`) |
| Attributes and attribute values | Each object and array of an attribute counts one level, and at most 16 levels are allowed (`AttributesSchema` and `AttributeValueSchema` in `confect/editor/node.ts`) | Target. This module reads generic ProseMirror attributes, which the contract's typed attributes do not cover, so the document's bound limits them too, and an admitted call can then be stored. |
| Steps sent in one call | At most 128 KiB and 32 steps (`MAX_BATCH_STEPS` in `confect/editor/size.ts`) | Measured, see Snapshots |
| A step that one call carries | At most `MAX_STEP_BYTES`: 128 KiB less the text that a call takes around its steps (its two ids and its version), measured at the longest ids and the largest safe version (`confect/editor/batch.ts`) | Computed by the encoder, and `batch.test.ts` pins it |
| A client id and a batch id | At least one and at most 64 characters each (`MAX_ID_LENGTH` in `confect/editor/batch.ts`) | Target. A v4 UUID from `randomUuid` has 36 characters. Each stored step keeps its client id, and the session record keeps the batch id. |
| Steps read in one call | At most 512 KiB | Target. 100 rows of nearly 1 MiB would pass the 16 MiB a transaction may read. `STEP_READ_BYTES` in `confect/editor/size.ts` is the budget, and Convex's `maximumBytesRead` enforces it. A read stops at the row that reaches the budget, so one read may pass it by that row, which is at most one batch of 128 KiB. A `since` reply reads at most `STEP_PAGE_STEPS`, 200 steps, and the client reads on from its last version. A submit reads at most `FOLD_STEP_LIMIT`, 24 steps, with one `.paginate()`, because Convex allows one paginated query per function. A fold reads its backlog with one `take` of at most 56 steps, which is `FOLD_STEP_LIMIT` plus one batch. `steps.impl.test.ts` pins a read that stops and the reads that continue it, and `result.test.ts` pins the refusal of a backlog that one read does not hold. |
| Snapshots | The fold writes the snapshot in one transaction when the steps that the snapshot lacks reach `FOLD_STEP_LIMIT`, 24 steps, or `FOLD_BYTE_LIMIT`, 256 KiB of text (`confect/editor/fold.ts`). A fold applies its backlog, at most 24 steps and one batch of 32 (`MAX_BATCH_STEPS`), so at most 56 steps. Measured in convex-test in Node, with temporary tests that were not committed, on a near-bound document of each shape: 49,700 hard breaks in one paragraph (about 1 MB of text), one long text node of about 1 MB, and the 49,700 hard breaks in one paragraph nested 13 blockquotes deep, which makes a document 16 levels deep (the deep shape). Each run created a new document of the shape, submitted its backlog in batches of at most 32, and timed the fold alone. There were five runs for each backlog of 8, 16, 24, 32, 40, 48, 56, and 64 steps and for each shape, at a one-minute load of about 17 to 19. A fold does not read `FOLD_STEP_LIMIT`, so these times hold for any limit. A fold of 8 steps took a median of 118 ms (hard breaks) and 145 ms (deep). A fold of 24 steps took a median of 142 ms (hard breaks) and 156 ms (deep), and at most 189 ms (hard breaks), 166 ms (deep), and 14 ms (long text). A fold of 32 steps took at most 391 ms (deep), so the limit is 24: it is the largest measured limit whose slowest fold is under a quarter of the 1 s user-code limit (250 ms). The worst backlog, 56 steps, took a median of 197 ms (hard breaks) and 203 ms (deep), and at most 245 ms (hard breaks) and 255 ms (deep), so one run of five is 5 ms over a quarter second, and the owner decides whether that is acceptable. The slowest runs are single spikes: a fold of 48 steps took 462.5 ms once (hard breaks) and 343.4 ms once (deep), and this measurement did not isolate their cause. A submit at this bound, 24 pending steps and a batch of 32, took a median of 310.5 ms (hard breaks, at most 380.2 ms), a median of 215.6 ms (deep, at most 218.4 ms), and at most 30.0 ms (long text). A submit reads one snapshot row and at most 24 step rows, and a fold reads one snapshot row and at most 56 step rows, both under the 16 MiB a transaction may read (computed from the row and step bounds, not counted). The 1 second limit of user code per mutation excludes database operations (limits page, read on 17 October 2026), and these figures include them. Each fold writes one snapshot of up to 1 MiB, so at the limit a near-bound document costs about 43 KiB of snapshot write per step (computed: 1 MiB divided by 24), where the earlier limit of 32 cost about 32 KiB. An earlier run, with the limit at 32 and the hard-break document only, measured a fold of 64 steps at 190, 188, 201, 306, and 244 ms (median 201; an earlier version of this row wrote the first value as 188, and the raw record says 190), a fold of 32 steps at 148 to 265 ms (median 169), and a submit with 32 pending steps and a batch of 32 at 190 to 593 ms (median 220). | Target, and measured on the bounds of this table. |
| An image file | At most 2 MB, with alternative text required | Target |
| Presence | A heartbeat every 10 seconds and a limit of 25 seconds | Target. Three editors write about 1,080 times an hour (computed). |
| Cursors | None in the first version | Three editors at one update a second would write about 10,800 times an hour for each document (computed). |

The size is checked where a whole document is written. A fold and the save to
the bank each refuse a document whose complete row would pass 1 MiB, before the
write (ADR 0031). A step carries no whole document, so a draft that grows past
the limit is refused at submit, before its step is written, and never reaches the bank.

The step log is bounded too: the fold of a document writes its snapshot, and the
log is pruned behind the snapshot (What Stays Open records the refusals that stop
it). A cron sweep,
`internal.editor.prune.sweep`, runs every ten minutes (`PRUNE_INTERVAL` in
`confect/editor/prune.ts`). It deletes the steps that a snapshot covers once they
are ten minutes old
(`STEP_KEEP_DELAY`). The delay is ten minutes so that a client offline for less
than that loads the steps it missed, and a client offline for longer opens again
from the snapshot. The sweep reads the log in pages of 64 steps
(`PRUNE_PAGE_STEPS`): a step is at most one batch of 128 KiB, so a page reads at
most 8 MiB of step text. Each document of the page is read once, through its
document row, which holds its snapshot version (`snapshotVersion`). The sweep
never reads a snapshot row: a snapshot holds a whole document, so reading one for
each document of a page could pass the 16 MiB that a transaction may read. A
client whose version is older than the oldest step that is kept gets `behind`
from `steps:since`, and it opens again from the snapshot. A page decides a
document's steps against the snapshot version it reads on that page, so a
snapshot saved between two pages can leave a gap in the kept log until the next
sweep. `steps:since` returns only the steps that follow its version without a
gap, and a read at the gap gets `behind`.

The session records have no sweep. A record is kept until its document is
deleted: a client that was away for any time may still need it to learn whether
its batch landed. The deletion of a document reads its records in pages of 64
(`PRUNE_PAGE_CLIENTS`). A record is a small row, so its page is bounded by its
count.

Acceptance: in `convex-test`, a submit at a stale version is refused, a document
at the node depth bound of 16 is stored and read back, and a fold whose
complete row would pass 1 MiB is refused and writes nothing, and a batch whose result would pass the bound or break the contract is refused before any write. In Playwright,
three editors work on one question and no step is lost, and the one renderer of
ADR 0018 draws a Nakafa question and a school question.

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
- The byte limits of the Files module, which the plan sets.
- Session records are kept until their document is deleted, so each session that
  had a batch accepted leaves one small row. A record is reclaimed only when its
  session confirms its last batch, and a query cannot record that: `steps:since`
  and `documents:open` are queries, which cannot write. A client mutation that
  confirms the batch would let a sweep reclaim the rows. The owner decides whether
  to add it.
- Submit reads each step's nodes and marks with the contract's own schemas
  (`confect/editor/content.ts`), so a heading level outside 1 to 3, a link to an
  address that is not https, and a mark that the contract does not allow are refused
  before any write. A list, an item, or a quote that a step leaves empty at an open edge, or in the gap of a replace-around step, is read with one paragraph or item in its place, because the document holds the content that the snapshot reads (`confect/editor/slice.ts`). Two kinds of step hold no node that the check reads: an attribute
  step and a document attribute step. The editor writes neither, because Tiptap
  replaces a node with a replace step, but a crafted attribute step can set a heading
  level that the contract refuses. Submit checks the document that the batch makes, so
  such a batch is refused with `DocumentInvalid` before any write. The owner decides
  whether a crafted attribute step that the contract accepts is refused too.
- Tiptap's ordered list input rule turns `0. ` into a list whose start is 0, which the contract refuses (`PositiveIntSchema` in `@nakafa/aksara-contracts/assessment/scalar`). The sync drops that step and counts it, so the change it made is not kept. The owner decides whether the assessment editor offers no list that starts at 0.
- A step that grows a document past `MAX_DOCUMENT_BYTES` is refused at submit with `DocumentTooLarge`, so an accepted batch never grows a document past the bound. Only a stored step that predates the check reaches the fold, which then fails with `DocumentTooLarge` and writes nothing. The skip rule covers the depth of a document and not its bytes, so the owner decides whether it takes the bytes too: skipping by bytes would measure the whole document for each stored step, up to 32 steps in one fold.
- A dropped step, or a step that the editor replays after it opens again, keeps
  its position in the document it is replayed on. A later step that depended on
  the dropped one can therefore land at another place, and the replay does not
  map it through the dropped step. The replay keeps each step that applies, and
  the count of dropped steps reports the loss. A mapping of the replay is open.
- The server's model (`confect/editor/model.ts`) and the editor's schema are one schema: both are built with `getSchema` from the extensions of `@repo/editor/document`, so a node or a mark has one declaration. `apps/www/lib/editor/assessment.test.ts` folds the steps of several of the editor's own commands on the server and compares the result with the editor's document, so the commands that reach each node and mark are pinned.
- The cost of a step grows with the children of the node it edits, because ProseMirror copies the children of each node that it changes: a step in a paragraph of 49,700 hard breaks costs about 1.5 ms more than the one before it, by the medians of the Snapshots row (Bounds). A bound on the children of a block in the contract (ADR 0031) would bound the fold and the submit too, and the owner decides whether to add one. At the limit of 24 steps a fold writes a snapshot of up to 1 MiB, which the owner may weigh against the time of the fold (Bounds, Snapshots).

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
| Tiptap 3.32.0 and KaTeX 0.19.0 | Live |
| `prosemirror-collab` 1.3.1 | Installed in `packages/design-system` (the `Collab` extension) and `apps/www` (the sync loop), and pinned in the dependency policy. |
| `mathlive` and `@convex-dev/presence` | Not installed. Planned for program wave B. |
| `confect/editor` pure core: the document, step, batch, attribute, and stored-step schemas (the stored step is in `confect/editor/log.ts`), the storage form, the version rule (`admitBatch`), the size bounds, and the snapshot rule | In code. The depth bound is `MAX_DOCUMENT_DEPTH` of `@nakafa/aksara-contracts` 0.49.0. The tests pin the bounds that this code holds, and the read bound of 512 KiB is `STEP_READ_BYTES`. |
| The tables `editorDocuments`, `editorSnapshots`, `editorSteps`, and `editorClients` (`confect/tables/editor*.ts`) | In code, not live. The head version and the snapshot version are on the document row, and the snapshot rows, the step rows, and the session records hold the rest. |
| The functions `editor/documents` (`create`, `open`) and `editor/steps` (`since`, `submit`), the fold `internal.editor.fold.fold`, and the sweep `internal.editor.prune.sweep` | In code and tested in convex-test, not live: no page calls them yet. |
| The server fold (`confect/editor/fold.ts`, `fold.impl.ts`, `fold.spec.ts`): the limits `FOLD_STEP_LIMIT` and `FOLD_BYTE_LIMIT`, the skip rule of the editors (logged at error level), the contract check of the folded document, and the single write at the head. The submit checks the document that a batch makes (`confect/editor/result.ts`) and refuses a backlog with `FoldPending` (`steps.impl.ts`). The public snapshot write is removed. | In code and tested in convex-test (`result.test.ts`, `fold.impl.test.ts`, `fold.test.ts`, `steps.impl.test.ts`, `prune.impl.test.ts`): a fold equals the document the editors make, a stale batch changes nothing, a skipped step is counted and logged at error level, the depth bound and the byte bound hold at their edge, a batch the contract refuses writes nothing, a backlog of two batches folds in one run, a backlog that one read does not hold is refused, the byte limit schedules the fold, a planted stored step that the contract refuses fails the fold with nothing written, a planted stored step that nests the document past the bound is skipped, a batch whose step nests the document past the bound is refused with nothing written (`result.test.ts`), and a deleted document is a no-op. |
| The server model (`confect/editor/model.ts`): the ProseMirror schema of the assessment document, built by `documentSchema` of `@repo/editor/document` from the rules of the contract | In code. `apps/www/lib/editor/assessment.test.ts` folds the steps of the editor's own commands on the server and compares the result with the editor's document. |
| The session record and the idempotent batch: the batch id, a repeat of an accepted batch answered with its version, `ClientTaken` for another account's session, and the record that `open` and `since` answer for the caller's own session | In code, not live: `confect/editor/steps.impl.ts`, `confect/editor/documents.impl.ts`, and `confect/editor/store.ts`. Tested in convex-test. |
| The behind replay: the confirmation of the in-flight batch that landed, the replay of the other unconfirmed steps onto the snapshot, and the one `SyncDropped` count | In code, not live: `apps/www/lib/editor/replay.ts`, tested with the fake server in `apps/www/lib/editor/replay.test.ts` and `apps/www/lib/editor/sync.test.ts`. |
| The skip rule: a stored step that does not apply, or that nests the document past `MAX_DOCUMENT_DEPTH`, is skipped by every editor and logged once; an editor whose own step the server skips opens again from the snapshot | In code, not live: the rule `confect/editor/apply.ts`, which the fold calls, and `apps/www/lib/editor/settle.ts`, which the editors call. Tested: `apply.test.ts` (a step the schema cannot read, one that does not apply, and one that nests the document one level past the bound, which the rule skips, while a step at the bound applies); three editors converge with a stored step that does not apply, and three editors converge within the bound when a stored step nests past it (`settle.test.ts`); and an editor skips a stored step that its schema cannot read, as the server does (`sync.test.ts`). |
| The depth filter of the editor: `depthGuard` refuses an edit that nests the document past the bound it is given | In code, not live: `packages/design-system/components/editor/depth.ts`. No editor mounts it yet, and the question editor passes `MAX_DOCUMENT_DEPTH`. |
| The size guards of the editor: `stepSizeGuard` refuses an edit with a step over the bound it is given, `documentSizeGuard` refuses an edit that grows the document past the bound it is given, and a queued step that no call can carry is dropped and counted (`dropUnsendable`) | In code, not live: `packages/design-system/components/editor/size.ts`, `apps/www/lib/editor/replay.ts`, and `apps/www/lib/editor/send.ts`. The question editor passes `MAX_STEP_BYTES`. `send.test.ts` admits a step of that size, which one call carries, and refuses one byte more. `batch.test.ts` pins the encoder's call to the same bound. Tested in `size.test.ts`, `batch.test.ts`, `send.test.ts`, and `sync.test.ts`. |
| The content check at submit (`confect/editor/content.ts`): the contract's block, inline, and mark schemas read each step's nodes and marks, and a refusal is `BatchInvalid` with nothing written | In code, not live: `confect/editor/steps.impl.ts`. Tested in `content.test.ts` and `steps.impl.test.ts`: a heading level of 4, a link that is not https, and a link mark out of the contract's order are refused; a list item, a heading of level 2, and an https link are accepted. A bullet list, an ordered list, or a quote that wraps a range, and a lift out of a quote, are accepted, because the content they need is in the gap or in the document; an empty list in a replace step is refused, and so is a list whose start is 0 (`slice.test.ts`). `apps/www/lib/editor/send.test.ts` covers the sync's drop of a step that the contract refuses. |
| The stored snapshot is the contract's output (`encodeDocument` in `confect/editor/document.ts`): attributes the contract does not name, such as a link's `target` and `rel`, are not stored | In code, not live. Tested in `document.test.ts`. |
| The sync modules: `apps/www/lib/editor/settle.ts` (settling and the skip rule), `replay.ts` (reopen, reseat, replay, and the drop), and `pull.ts` (the apply path) | In code, not live. `settle.ts` imports none of the other two, so no two modules import each other. `pull.ts` holds the apply path, which calls `reopen`. |
| The Tiptap cohort: the dependency policy holds every Tiptap package of the design system, and `@tiptap/pm` of the web app, to `TIPTAP_COHORT_VERSION` (3.32.0) in `scripts/dependencies/policy.ts` | In code. The dependency policy test enforces it. |
| The assessment rules: `documentSchema` takes the rules its caller gives, the marks in their order, the heading levels, and the link rule (`packages/editor/document.ts`). `ASSESSMENT_RULES` in `confect/editor/model.ts` gives it the contract's marks in the contract's order (`MarkTypeSchema`), the heading levels 1 to 3, and `isHttpsUrl`, and the editor (`apps/www/lib/editor/assessment.ts`) builds its schema from the same rules and holds no horizontal rule. The server admits the node and mark types that the editor reads (`NodeTypeSchema` and `MarkTypeSchema` in `confect/editor/node.ts`), in a step and in a snapshot. | In code, not live. Tested in `packages/editor/document.test.ts`, at the commands of a headless editor: a heading level, a horizontal rule, and a link address. Tested in `assessment.test.ts`: the node types, the heading levels pinned to the contract's check, and the link rule. Tested on the server in `batch.test.ts` and `document.test.ts`: a step or a snapshot with a type the editor does not read is refused. |
| The deletion of a document: its session records and its steps in pages, then its snapshot and its document row (`internal.editor.deletion.document`) | In code, not live: `confect/editor/deletion.impl.ts`, tested in convex-test. Its one caller is the school exam removal, `exams.questions.remove`, which schedules it for the question's prompt (row below). |
| The `document` access kind (`confect/editor/kinds.ts`), its authority, and its catalog entry | In code. ADR 0012 names it. |
| The sync slice: the head version on the draft row, the step log and its pruning, the server fold that writes the snapshot, and the sync loop `apps/www/lib/editor/sync.ts`, which pulls and pushes steps and never writes a snapshot | In code, not live: `confect/editor/store.ts`, `confect/editor/prune.ts`, `confect/editor/fold.ts`, and the sync loop, which the fake-client tests drive. |
| The client engine: the `Collab` extension in `packages/design-system/components/editor/collab.ts` and the sync loop in `apps/www/lib/editor` | In code. No page mounts the editor yet. |
| The editor's shared schema (`packages/editor`, `@repo/editor`): the Tiptap extensions of the assessment document, from which the editor and the server both derive their schema with `getSchema` | In code, not live. The backend declares the Tiptap packages that its bundle imports, and `scripts/dependencies/policy.ts` holds every declaration to 3.32.0. The design system's Memory editor keeps its own extensions. |
| The client's answer to a refused batch (`apps/www/lib/editor/send.ts`): the halving of a batch that the contract refuses, the drop of one step that it refuses alone (`SyncDropped`), and the next round for a batch that waits for a fold | In code, not live. `apps/www/lib/editor/send.test.ts` halves a refused batch and drops its refused step once, and it sends a batch that waited for a fold again. The fake server of `apps/www/test/sync.ts` refuses a batch as the server does. |
| The formula node | Planned, program wave B |
| Mermaid and content math under the forced KaTeX 0.19.0 | To be tested in program wave A |
| `confect/files` and `fileRecords` | Planned, program wave B |
| `ninaUploads` and `nina/uploads.*` | Live, replaced by `confect/files` |
| The import from a PDF | Planned. It waits for the accuracy gate. |
| The import from Google Forms | Planned, with the connectors (ADR 0015) |
| The sentence in AGENTS.md about teacher questions | Not written |
| The school exam functions (`confect/exams`) create a question's prompt through `createDocument` in `confect/editor/create.ts`, and, when a question is removed, schedule `internal.editor.deletion.document` for its prompt, which deletes the records of the document's editor sessions and its steps in pages, then its snapshot and its document row. A copy reads the original's steps after its snapshot through `stepsThrough` in `confect/editor/store.ts`, and refuses a history longer than one page of steps (`STEP_PAGE_STEPS`) before it reads any step, so a copy reads at most one page. | In code and tested in convex-test, not live. They are the first callers of the creator and the deleter. |
| The school exam editor page and its client mount of the sync loop (`apps/www/lib/editor/sync.ts`) | Not built. A later lane mounts the editor and drives the loop from the Confect hooks. |
