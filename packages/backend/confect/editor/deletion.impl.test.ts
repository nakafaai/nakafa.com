import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  batchText,
  clientRows,
  documentRows,
  nf,
  paragraphText,
  snapshotRows,
  stepRows,
} from "@repo/backend/test/editor";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const documents = refs.public.editor.documents;
const steps = refs.public.editor.steps;
const fold = refs.internal.editor.fold.fold;
const deletion = refs.internal.editor.deletion;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TENANCY_NOW);
});

describe("editor/deletion document", () => {
  it.effect(
    "deletes a document with its steps, its snapshot, and its session records, and no other document's rows",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const removed = yield* teacher.mutation(documents.create, {
          content: paragraphText("Soal"),
          scope: { kind: "unit", unitId: fixture.units.smp },
          slug: nf,
        });
        const kept = yield* teacher.mutation(documents.create, {
          content: paragraphText("Soal"),
          scope: { kind: "unit", unitId: fixture.units.smp },
          slug: nf,
        });
        yield* teacher.mutation(steps.submit, {
          batch: yield* batchText(0, "rina", 2),
          documentId: removed.id,
          slug: nf,
        });
        yield* fixture.as("admin").mutation(steps.submit, {
          batch: yield* batchText(2, "hendra", 1),
          documentId: removed.id,
          slug: nf,
        });
        yield* teacher.mutation(steps.submit, {
          batch: yield* batchText(0, "rina", 1),
          documentId: kept.id,
          slug: nf,
        });
        yield* fixture.internal.mutation(fold, { documentId: removed.id });
        expect(yield* fixture.run(clientRows)).toHaveLength(3);
        const done = yield* fixture.internal.mutation(deletion.document, {
          documentId: removed.id,
        });
        expect(done).toEqual({ done: true });
        expect(
          Arr.map(yield* fixture.run(documentRows), (row) => row._id)
        ).toEqual([kept.id]);
        expect(
          Arr.map(yield* fixture.run(snapshotRows), (row) => row.documentId)
        ).toEqual([kept.id]);
        expect(
          Arr.map(yield* fixture.run(stepRows), (row) => row.documentId)
        ).toEqual([kept.id]);
        expect(
          Arr.map(yield* fixture.run(clientRows), (row) => row.documentId)
        ).toEqual([kept.id]);
      })
  );

  it.effect(
    "deletes the steps of a document one page at a time, and finishes the rest through the scheduler",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const made = yield* teacher.mutation(documents.create, {
          content: paragraphText("Soal"),
          scope: { kind: "unit", unitId: fixture.units.smp },
          slug: nf,
        });
        yield* teacher.mutation(steps.submit, {
          batch: yield* batchText(0, "rina", 70),
          documentId: made.id,
          slug: nf,
        });
        const firstPage = yield* fixture.internal.mutation(deletion.document, {
          documentId: made.id,
        });
        expect(firstPage).toEqual({ done: false });
        expect(yield* fixture.run(stepRows)).toHaveLength(6);
        yield* fixture.finishScheduled();
        expect(yield* fixture.run(stepRows)).toEqual([]);
        expect(yield* fixture.run(documentRows)).toEqual([]);
        expect(yield* fixture.run(snapshotRows)).toEqual([]);
      })
  );

  it.effect(
    "deletes the session records of a document one page at a time, and finishes the rest through the scheduler",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const made = yield* teacher.mutation(documents.create, {
          content: paragraphText("Soal"),
          scope: { kind: "unit", unitId: fixture.units.smp },
          slug: nf,
        });
        // One session per step, so the head reaches 65 and every session holds a record.
        for (const index of Arr.makeBy(65, (step) => step)) {
          yield* teacher.mutation(steps.submit, {
            batch: yield* batchText(index, `rina-${index}`, 1),
            documentId: made.id,
            slug: nf,
          });
        }
        const firstPage = yield* fixture.internal.mutation(deletion.document, {
          documentId: made.id,
        });
        expect(firstPage).toEqual({ done: false });
        yield* fixture.finishScheduled();
        expect(yield* fixture.run(clientRows)).toEqual([]);
        expect(yield* fixture.run(stepRows)).toEqual([]);
        expect(yield* fixture.run(documentRows)).toEqual([]);
      })
  );
});
