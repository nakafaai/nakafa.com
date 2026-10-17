import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { encodeBatch } from "@repo/backend/confect/editor/batch";
import { MAX_DOCUMENT_BYTES } from "@repo/backend/confect/editor/size";
import type { Step } from "@repo/backend/confect/editor/step";
import {
  batchText,
  jsonValue,
  newDocument,
  nf,
  paragraphText,
  snapshotRows,
  stepRows,
} from "@repo/backend/test/editor";
import { nestBlockquotes, paragraphOf } from "@repo/backend/test/editor/nodes";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { encodeJsonText } from "@repo/utilities/json";
import { utf8Bytes } from "@repo/utilities/text";
import { Array as Arr, Effect } from "effect";

const documents = refs.public.editor.documents;
const steps = refs.public.editor.steps;
const fold = refs.internal.editor.fold.fold;
const deletion = refs.internal.editor.deletion;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TENANCY_NOW);
});

/** A replace step that inserts `text` at `position`, inside the paragraph of `Soal`. */
const insertAt = (position: number, text: string): Step => ({
  from: position,
  slice: { content: [{ text, type: "text" }] },
  stepType: "replace",
  to: position,
});

/** A replace step that inserts `count` blockquotes around a paragraph at the start of a document. */
const blockquotesAtStart = (count: number): Step => ({
  from: 0,
  slice: {
    content: [nestBlockquotes(count, { type: "paragraph" })],
  },
  stepType: "replace",
  to: 0,
});

/** A batch of steps made on `baseVersion`, from the client `rina`, as its JSON text. */
const batchOf = (
  batch: string,
  baseVersion: number,
  steps: readonly [Step, ...Step[]]
) =>
  encodeBatch({ baseVersion, batch, clientId: "rina", steps }).pipe(
    Effect.orDie
  );

describe("editor/fold", () => {
  it.effect(
    "folds the accepted steps into the snapshot, as the editors apply them",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const documentId = yield* newDocument(fixture);
        const teacher = fixture.as("teacher");
        yield* teacher.mutation(steps.submit, {
          batch: yield* batchOf("first", 0, [insertAt(5, "!")]),
          documentId,
          slug: nf,
        });
        yield* teacher.mutation(steps.submit, {
          batch: yield* batchOf("second", 1, [insertAt(1, "?")]),
          documentId,
          slug: nf,
        });
        const folded = yield* fixture.internal.mutation(fold, { documentId });
        expect(folded).toEqual({ done: true, folded: 2, skipped: 0 });
        const [snapshot] = yield* fixture.run(snapshotRows);
        expect(snapshot.version).toBe(2);
        expect(jsonValue(snapshot.content)).toEqual(paragraphOf("?Soal!"));
      })
  );

  it.effect(
    "lets a stale batch change nothing, so the snapshot stays the fold of the accepted steps",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const documentId = yield* newDocument(fixture);
        const teacher = fixture.as("teacher");
        yield* teacher.mutation(steps.submit, {
          batch: yield* batchOf("first", 0, [insertAt(5, "!")]),
          documentId,
          slug: nf,
        });
        yield* fixture.internal.mutation(fold, { documentId });
        const stale = yield* teacher
          .mutation(steps.submit, {
            batch: yield* batchOf("stale", 0, [insertAt(1, "?")]),
            documentId,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(stale).toMatchObject({ _tag: "VersionStale" });
        yield* fixture.internal.mutation(fold, { documentId });
        const [snapshot] = yield* fixture.run(snapshotRows);
        expect(snapshot.version).toBe(1);
        expect(jsonValue(snapshot.content)).toEqual(paragraphOf("Soal!"));
      })
  );

  it.effect(
    "skips a stored step that does not apply, as every editor skips it, and counts it in the version",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const documentId = yield* newDocument(fixture);
        const teacher = fixture.as("teacher");
        yield* teacher.mutation(steps.submit, {
          batch: yield* batchOf("first", 0, [insertAt(5, "!")]),
          documentId,
          slug: nf,
        });
        yield* teacher.mutation(steps.submit, {
          batch: yield* batchOf("beyond", 1, [insertAt(999, "x")]),
          documentId,
          slug: nf,
        });
        yield* teacher.mutation(steps.submit, {
          batch: yield* batchOf("last", 2, [insertAt(1, "?")]),
          documentId,
          slug: nf,
        });
        const folded = yield* fixture.internal.mutation(fold, { documentId });
        expect(folded).toEqual({ done: true, folded: 3, skipped: 1 });
        const [snapshot] = yield* fixture.run(snapshotRows);
        expect(snapshot.version).toBe(3);
        expect(jsonValue(snapshot.content)).toEqual(paragraphOf("?Soal!"));
      })
  );

  it.effect(
    "accepts a document at the depth bound, and skips a step that nests the document one level past it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const documentId = yield* newDocument(fixture);
        const teacher = fixture.as("teacher");
        // The document is 16 levels deep after the first step, the bound of the contract.
        yield* teacher.mutation(steps.submit, {
          batch: yield* batchOf("inside", 0, [blockquotesAtStart(14)]),
          documentId,
          slug: nf,
        });
        yield* teacher.mutation(steps.submit, {
          batch: yield* batchOf("beyond", 1, [blockquotesAtStart(15)]),
          documentId,
          slug: nf,
        });
        const folded = yield* fixture.internal.mutation(fold, { documentId });
        expect(folded).toEqual({ done: true, folded: 2, skipped: 1 });
        const [snapshot] = yield* fixture.run(snapshotRows);
        expect(snapshot.version).toBe(2);
        expect(jsonValue(snapshot.content)).toEqual({
          content: [
            nestBlockquotes(14, { type: "paragraph" }),
            { content: [{ text: "Soal", type: "text" }], type: "paragraph" },
          ],
          type: "doc",
        });
      })
  );

  it.effect(
    "refuses a snapshot the contract refuses, keeps the stored one, and leaves its steps in the log",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* fixture.as("admin").mutation(documents.create, {
          content: encodeJsonText({
            content: [
              {
                attrs: { level: 1 },
                content: [{ text: "Soal", type: "text" }],
                type: "heading",
              },
            ],
            type: "doc",
          }),
          scope: { kind: "tenant" },
          slug: nf,
        });
        // An attribute step sets a heading level the contract refuses. The editor
        // writes no such step, but a crafted one reaches the log, so the fold refuses it.
        yield* fixture.as("admin").mutation(steps.submit, {
          batch: yield* batchOf("crafted", 0, [
            { attr: "level", pos: 0, stepType: "attr", value: 4 },
          ]),
          documentId: made.id,
          slug: nf,
        });
        const refused = yield* fixture.internal
          .mutation(fold, { documentId: made.id })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "DocumentInvalid" });
        const [snapshot] = yield* fixture.run(snapshotRows);
        expect(snapshot.version).toBe(0);
        expect(
          Arr.map(yield* fixture.run(stepRows), (row) => row.version)
        ).toEqual([1]);
      })
  );

  it.effect(
    "folds a backlog one page of the log at a time, and the fold it leaves starts the next page",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const documentId = yield* newDocument(fixture);
        const teacher = fixture.as("teacher");
        // The first batch reaches the fold limit, so it schedules the fold.
        yield* teacher.mutation(steps.submit, {
          batch: yield* batchText(0, "rina", 200),
          documentId,
          slug: nf,
        });
        yield* teacher.mutation(steps.submit, {
          batch: yield* batchText(200, "rina", 50),
          documentId,
          slug: nf,
        });
        const firstPage = yield* fixture.internal.mutation(fold, {
          documentId,
        });
        expect(firstPage).toEqual({ done: false, folded: 200, skipped: 0 });
        yield* fixture.finishScheduled();
        const [snapshot] = yield* fixture.run(snapshotRows);
        expect(snapshot.version).toBe(250);
      })
  );

  it.effect("does nothing when no step follows the snapshot", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const documentId = yield* newDocument(fixture);
      const folded = yield* fixture.internal.mutation(fold, { documentId });
      expect(folded).toEqual({ done: true, folded: 0, skipped: 0 });
      const [snapshot] = yield* fixture.run(snapshotRows);
      expect(snapshot.version).toBe(0);
    })
  );

  it.effect("does nothing for a document deleted before its fold runs", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const documentId = yield* newDocument(fixture);
      yield* fixture.as("teacher").mutation(steps.submit, {
        batch: yield* batchText(0, "rina", 3),
        documentId,
        slug: nf,
      });
      yield* fixture.internal.mutation(deletion.document, { documentId });
      const folded = yield* fixture.internal.mutation(fold, { documentId });
      expect(folded).toEqual({ done: true, folded: 0, skipped: 0 });
    })
  );

  it.effect(
    "folds a document near its bound into a snapshot that stays under the bound",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const overhead = utf8Bytes(paragraphText(""));
        const made = yield* fixture.as("admin").mutation(documents.create, {
          content: paragraphText(
            "a".repeat(MAX_DOCUMENT_BYTES - overhead - 100)
          ),
          scope: { kind: "tenant" },
          slug: nf,
        });
        yield* fixture.as("admin").mutation(steps.submit, {
          batch: yield* batchOf("grow", 0, [insertAt(1, "b".repeat(50))]),
          documentId: made.id,
          slug: nf,
        });
        const folded = yield* fixture.internal.mutation(fold, {
          documentId: made.id,
        });
        expect(folded).toEqual({ done: true, folded: 1, skipped: 0 });
        const [snapshot] = yield* fixture.run(snapshotRows);
        expect(snapshot.version).toBe(1);
        expect(utf8Bytes(snapshot.content)).toBeLessThan(MAX_DOCUMENT_BYTES);
      })
  );

  it.effect(
    "refuses a fold one byte past the bound, and keeps the stored snapshot",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const overhead = utf8Bytes(paragraphText(""));
        const made = yield* fixture.as("admin").mutation(documents.create, {
          content: paragraphText("a".repeat(MAX_DOCUMENT_BYTES - overhead)),
          scope: { kind: "tenant" },
          slug: nf,
        });
        yield* fixture.as("admin").mutation(steps.submit, {
          batch: yield* batchOf("grow", 0, [insertAt(1, "b")]),
          documentId: made.id,
          slug: nf,
        });
        const refused = yield* fixture.internal
          .mutation(fold, { documentId: made.id })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({
          _tag: "DocumentTooLarge",
          limit: MAX_DOCUMENT_BYTES,
        });
        const [snapshot] = yield* fixture.run(snapshotRows);
        expect(snapshot.version).toBe(0);
      })
  );

  it.effect(
    "schedules the fold once the steps the snapshot lacks reach the fold limit, and not before",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const documentId = yield* newDocument(fixture);
        const teacher = fixture.as("teacher");
        yield* teacher.mutation(steps.submit, {
          batch: yield* batchText(0, "rina", 150),
          documentId,
          slug: nf,
        });
        yield* teacher.mutation(steps.submit, {
          batch: yield* batchText(150, "rina", 49),
          documentId,
          slug: nf,
        });
        // 199 steps are pending, one below the limit, so no fold is scheduled.
        yield* fixture.finishScheduled();
        expect(
          Arr.map(yield* fixture.run(snapshotRows), (row) => row.version)
        ).toEqual([0]);
        yield* teacher.mutation(steps.submit, {
          batch: yield* batchText(199, "rina", 1),
          documentId,
          slug: nf,
        });
        // The submit that reaches the limit schedules the fold, which writes the snapshot.
        yield* fixture.finishScheduled();
        expect(
          Arr.map(yield* fixture.run(snapshotRows), (row) => row.version)
        ).toEqual([200]);
      })
  );
});
