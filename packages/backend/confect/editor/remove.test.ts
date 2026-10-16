import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { removeDocument } from "@repo/backend/confect/editor/remove";
import {
  batchText,
  documentRows,
  nf,
  paragraphText,
  snapshotRows,
  stepRows,
} from "@repo/backend/test/editor";
import { tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { create } = refs.public.editor.documents;
const { submit } = refs.public.editor.steps;

describe("editor/remove", () => {
  it.effect(
    "deletes a document with its snapshot and every step, though its step log takes more than one read",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const removed = yield* teacher.mutation(create, {
          content: paragraphText("Dihapus"),
          scope: { kind: "unit", unitId: fixture.units.smp },
          slug: nf,
        });
        const kept = yield* teacher.mutation(create, {
          content: paragraphText("Tinggal"),
          scope: { kind: "unit", unitId: fixture.units.smp },
          slug: nf,
        });
        yield* teacher.mutation(submit, {
          batch: yield* batchText(0, "rina", 200),
          documentId: removed.id,
          slug: nf,
        });
        yield* teacher.mutation(submit, {
          batch: yield* batchText(200, "rina", 1),
          documentId: removed.id,
          slug: nf,
        });
        yield* teacher.mutation(submit, {
          batch: yield* batchText(0, "rina", 1),
          documentId: kept.id,
          slug: nf,
        });
        yield* fixture.run(removeDocument(removed.id));
        const documents = yield* fixture.run(documentRows);
        expect(Arr.map(documents, (document) => document._id)).toEqual([
          kept.id,
        ]);
        const snapshots = yield* fixture.run(snapshotRows);
        expect(Arr.map(snapshots, (snapshot) => snapshot.documentId)).toEqual([
          kept.id,
        ]);
        const steps = yield* fixture.run(stepRows);
        expect(Arr.map(steps, (step) => step.documentId)).toEqual([kept.id]);
      })
  );
});
