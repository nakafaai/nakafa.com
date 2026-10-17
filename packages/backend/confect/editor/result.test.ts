import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { encodeBatch } from "@repo/backend/confect/editor/batch";
import { FOLD_STEP_LIMIT } from "@repo/backend/confect/editor/fold";
import { MAX_DOCUMENT_BYTES } from "@repo/backend/confect/editor/size";
import type { Step } from "@repo/backend/confect/editor/step";
import {
  batchText,
  blockquotesAtStart,
  documentRowOf,
  newDocument,
  nf,
  paragraphText,
  snapshotRows,
  stepRows,
} from "@repo/backend/test/editor";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { encodeJsonText } from "@repo/utilities/json";
import { utf8Bytes } from "@repo/utilities/text";
import { Array as Arr, Effect } from "effect";

const documents = refs.public.editor.documents;
const steps = refs.public.editor.steps;
const fold = refs.internal.editor.fold.fold;

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

/** The JSON text of one batch of `steps`, made on `baseVersion` by the client `rina`. */
const batchOf = (
  batch: string,
  baseVersion: number,
  steps: readonly [Step, ...Step[]]
) =>
  encodeBatch({ baseVersion, batch, clientId: "rina", steps }).pipe(
    Effect.orDie
  );

describe("editor/result submit", () => {
  it.effect(
    "refuses a batch that makes a heading level the contract refuses, with DocumentInvalid, and writes nothing",
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
        // An attribute step sets a heading level the contract refuses. Its value is not read
        // by the step check, so the document it makes is checked here, before any write.
        const refused = yield* fixture
          .as("admin")
          .mutation(steps.submit, {
            batch: yield* batchOf("crafted", 0, [
              { attr: "level", pos: 0, stepType: "attr", value: 4 },
            ]),
            documentId: made.id,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "DocumentInvalid" });
        expect(yield* fixture.run(stepRows)).toEqual([]);
        const document = yield* fixture.run(documentRowOf(made.id));
        expect(document.head).toBe(0);
      })
  );

  it.effect(
    "refuses a batch whose step nests the document past the depth bound, with DocumentInvalid, and writes nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const documentId = yield* newDocument(fixture);
        const teacher = fixture.as("teacher");
        // The first step takes the document to the depth bound, which the contract accepts.
        yield* teacher.mutation(steps.submit, {
          batch: yield* batchOf("inside", 0, [blockquotesAtStart(14)]),
          documentId,
          slug: nf,
        });
        // One more level passes the bound, so the batch is refused before any write.
        const refused = yield* teacher
          .mutation(steps.submit, {
            batch: yield* batchOf("beyond", 1, [blockquotesAtStart(15)]),
            documentId,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "DocumentInvalid" });
        expect(
          Arr.map(yield* fixture.run(stepRows), (row) => row.version)
        ).toEqual([1]);
        const document = yield* fixture.run(documentRowOf(documentId));
        expect(document.head).toBe(1);
      })
  );

  it.effect(
    "refuses a batch that grows the document one byte past the bound, with DocumentTooLarge, and writes nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const overhead = utf8Bytes(paragraphText(""));
        const made = yield* fixture.as("admin").mutation(documents.create, {
          content: paragraphText("a".repeat(MAX_DOCUMENT_BYTES - overhead)),
          scope: { kind: "tenant" },
          slug: nf,
        });
        const refused = yield* fixture
          .as("admin")
          .mutation(steps.submit, {
            batch: yield* batchOf("grow", 0, [insertAt(1, "b")]),
            documentId: made.id,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({
          _tag: "DocumentTooLarge",
          limit: MAX_DOCUMENT_BYTES,
        });
        expect(yield* fixture.run(stepRows)).toEqual([]);
        const document = yield* fixture.run(documentRowOf(made.id));
        expect(document.head).toBe(0);
      })
  );

  it.effect(
    "checks the document a batch makes, so a batch that passes the bound in the middle and ends under it is accepted",
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
        // The first step passes the bound, and the second removes what it added. The fold
        // stores only the document after the batch, so the batch is accepted.
        const accepted = yield* fixture.as("admin").mutation(steps.submit, {
          batch: yield* batchOf("pass", 0, [
            insertAt(1, "b".repeat(200)),
            { from: 1, stepType: "replace", to: 201 },
          ]),
          documentId: made.id,
          slug: nf,
        });
        expect(accepted).toBeNull();
        const folded = yield* fixture.internal.mutation(fold, {
          documentId: made.id,
        });
        expect(folded).toEqual({ folded: 2, skipped: 0 });
      })
  );

  it.effect(
    "refuses a batch with FoldPending while the steps the snapshot lacks are more than one read holds, and accepts it once they fold",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const documentId = yield* newDocument(fixture);
        const teacher = fixture.as("teacher");
        const backlog = 2 * FOLD_STEP_LIMIT;
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
        // The backlog is two batches, and one read holds one of them, so the third batch waits.
        const pending = yield* teacher
          .mutation(steps.submit, {
            batch: yield* batchText(backlog, "rina", 1),
            documentId,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(pending).toMatchObject({ _tag: "FoldPending" });
        expect(yield* fixture.run(stepRows)).toHaveLength(backlog);
        yield* fixture.internal.mutation(fold, { documentId });
        yield* teacher.mutation(steps.submit, {
          batch: yield* batchText(backlog, "rina", 1),
          documentId,
          slug: nf,
        });
        const [snapshot] = yield* fixture.run(snapshotRows);
        expect(snapshot.version).toBe(backlog);
      })
  );

  it.effect(
    "refuses a batch with FoldPending while the steps the snapshot lacks fill more than one read's bytes",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const documentId = yield* newDocument(fixture);
        const teacher = fixture.as("teacher");
        const text = "x".repeat(120_000);
        // One read takes at most 512 KiB, and a row that reaches that budget is the last row
        // of the read. Five steps of 120 KB reach it, so six pending steps do not fit one read.
        yield* Effect.forEach(
          Arr.makeBy(6, (version) => version),
          (version) =>
            Effect.flatMap(batchText(version, "rina", 1, text), (batch) =>
              teacher.mutation(steps.submit, { batch, documentId, slug: nf })
            ),
          { discard: true }
        );
        const pending = yield* teacher
          .mutation(steps.submit, {
            batch: yield* batchText(6, "rina", 1, text),
            documentId,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(pending).toMatchObject({ _tag: "FoldPending" });
        expect(yield* fixture.run(stepRows)).toHaveLength(6);
      })
  );
});
