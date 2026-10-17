import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { encodeBatch } from "@repo/backend/confect/editor/batch";
import { FOLD_STEP_LIMIT } from "@repo/backend/confect/editor/fold";
import {
  MAX_BATCH_STEPS,
  MAX_DOCUMENT_BYTES,
} from "@repo/backend/confect/editor/size";
import type { Step } from "@repo/backend/confect/editor/step";
import {
  batchText,
  blockquotesAtStart,
  jsonValue,
  newDocument,
  nf,
  paragraphText,
  plantStep,
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
        expect(folded).toEqual({ folded: 2, skipped: 0 });
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
        expect(folded).toEqual({ folded: 3, skipped: 1 });
        const [snapshot] = yield* fixture.run(snapshotRows);
        expect(snapshot.version).toBe(3);
        expect(jsonValue(snapshot.content)).toEqual(paragraphOf("?Soal!"));
      })
  );

  it.effect(
    "accepts a document at the depth bound, and skips a stored step that nests it one level past the bound",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const documentId = yield* newDocument(fixture);
        // The document is 16 levels deep after the first step, the bound of the contract.
        yield* fixture.as("teacher").mutation(steps.submit, {
          batch: yield* batchOf("inside", 0, [blockquotesAtStart(14)]),
          documentId,
          slug: nf,
        });
        // The submit refuses such a batch (`result.test.ts`), so only a planted step reaches the log.
        yield* plantStep(fixture, documentId, blockquotesAtStart(15));
        const folded = yield* fixture.internal.mutation(fold, { documentId });
        expect(folded).toEqual({ folded: 2, skipped: 1 });
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
    "refuses a stored step that the contract refuses, keeps the stored snapshot, and leaves its steps in the log",
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
        // The submit refuses such a batch (`result.test.ts`), so only a planted step reaches the log.
        yield* plantStep(fixture, made.id, {
          attr: "level",
          pos: 0,
          stepType: "attr",
          value: 4,
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

  it.effect("folds the backlog of two batches in one run", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const documentId = yield* newDocument(fixture);
      const teacher = fixture.as("teacher");
      // The first batch reaches the fold limit, so it schedules the fold. The second batch
      // is accepted before that fold runs, because one read still holds the backlog.
      yield* teacher.mutation(steps.submit, {
        batch: yield* batchText(0, "rina", FOLD_STEP_LIMIT),
        documentId,
        slug: nf,
      });
      yield* teacher.mutation(steps.submit, {
        batch: yield* batchText(FOLD_STEP_LIMIT, "rina", FOLD_STEP_LIMIT),
        documentId,
        slug: nf,
      });
      const folded = yield* fixture.internal.mutation(fold, { documentId });
      expect(folded).toEqual({
        folded: 2 * FOLD_STEP_LIMIT,
        skipped: 0,
      });
      const [snapshot] = yield* fixture.run(snapshotRows);
      expect(snapshot.version).toBe(2 * FOLD_STEP_LIMIT);
    })
  );

  it.effect("folds a full batch of steps in one run", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const documentId = yield* newDocument(fixture);
      yield* fixture.as("teacher").mutation(steps.submit, {
        batch: yield* batchText(0, "rina", MAX_BATCH_STEPS),
        documentId,
        slug: nf,
      });
      const folded = yield* fixture.internal.mutation(fold, { documentId });
      expect(folded).toEqual({ folded: MAX_BATCH_STEPS, skipped: 0 });
      const [snapshot] = yield* fixture.run(snapshotRows);
      expect(snapshot.version).toBe(MAX_BATCH_STEPS);
    })
  );

  it.effect("does nothing when no step follows the snapshot", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const documentId = yield* newDocument(fixture);
      const folded = yield* fixture.internal.mutation(fold, { documentId });
      expect(folded).toEqual({ folded: 0, skipped: 0 });
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
      expect(folded).toEqual({ folded: 0, skipped: 0 });
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
        expect(folded).toEqual({ folded: 1, skipped: 0 });
        const [snapshot] = yield* fixture.run(snapshotRows);
        expect(snapshot.version).toBe(1);
        expect(utf8Bytes(snapshot.content)).toBeLessThan(MAX_DOCUMENT_BYTES);
      })
  );

  it.effect(
    "refuses a stored step that grows the document one byte past the bound, and keeps the stored snapshot",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const overhead = utf8Bytes(paragraphText(""));
        const made = yield* fixture.as("admin").mutation(documents.create, {
          content: paragraphText("a".repeat(MAX_DOCUMENT_BYTES - overhead)),
          scope: { kind: "tenant" },
          slug: nf,
        });
        // The submit refuses this batch (`result.test.ts`), so only a planted step reaches the log.
        yield* plantStep(fixture, made.id, insertAt(1, "b"));
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
          batch: yield* batchText(0, "rina", FOLD_STEP_LIMIT - 1),
          documentId,
          slug: nf,
        });
        // One step below the limit, so no fold is scheduled.
        yield* fixture.finishScheduled();
        expect(
          Arr.map(yield* fixture.run(snapshotRows), (row) => row.version)
        ).toEqual([0]);
        yield* teacher.mutation(steps.submit, {
          batch: yield* batchText(FOLD_STEP_LIMIT - 1, "rina", 1),
          documentId,
          slug: nf,
        });
        // The submit that reaches the limit schedules the fold, which writes the snapshot.
        yield* fixture.finishScheduled();
        expect(
          Arr.map(yield* fixture.run(snapshotRows), (row) => row.version)
        ).toEqual([FOLD_STEP_LIMIT]);
      })
  );

  it.effect(
    "schedules the fold once the steps the snapshot lacks reach the byte limit, and not before",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const documentId = yield* newDocument(fixture);
        const teacher = fixture.as("teacher");
        const text = "x".repeat(100_000);
        yield* teacher.mutation(steps.submit, {
          batch: yield* batchText(0, "rina", 1, text),
          documentId,
          slug: nf,
        });
        yield* teacher.mutation(steps.submit, {
          batch: yield* batchText(1, "rina", 1, text),
          documentId,
          slug: nf,
        });
        // 200 KB of text is pending, below the byte limit, so no fold is scheduled.
        yield* fixture.finishScheduled();
        expect(
          Arr.map(yield* fixture.run(snapshotRows), (row) => row.version)
        ).toEqual([0]);
        yield* teacher.mutation(steps.submit, {
          batch: yield* batchText(2, "rina", 1, text),
          documentId,
          slug: nf,
        });
        // The submit that crosses the byte limit schedules the fold, which writes the snapshot.
        yield* fixture.finishScheduled();
        expect(
          Arr.map(yield* fixture.run(snapshotRows), (row) => row.version)
        ).toEqual([3]);
      })
  );
});
