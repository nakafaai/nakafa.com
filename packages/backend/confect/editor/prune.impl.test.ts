import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import {
  batchText,
  clientRows,
  IDLE,
  LONG_AGO,
  nf,
  paragraphText,
  snapshotRows,
  stepRows,
} from "@repo/backend/test/editor";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const documents = refs.public.editor.documents;
const steps = refs.public.editor.steps;
const snapshots = refs.public.editor.snapshots;
const prune = refs.internal.editor.prune;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TENANCY_NOW);
});

describe("editor/prune sweep", () => {
  it.effect(
    "keeps every step after the snapshot, and deletes a covered step only once it is old enough",
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
          batch: yield* batchText(0, "rina", 3),
          documentId: made.id,
          slug: nf,
        });
        vi.setSystemTime(TENANCY_NOW + IDLE);
        yield* teacher.mutation(snapshots.save, {
          content: paragraphText("Soal"),
          documentId: made.id,
          slug: nf,
          version: 3,
        });
        yield* teacher.mutation(steps.submit, {
          batch: yield* batchText(3, "rina", 2),
          documentId: made.id,
          slug: nf,
        });
        const youngSweep = yield* fixture.internal.mutation(prune.sweep, {
          cursor: null,
        });
        expect(youngSweep).toEqual({ deleted: 0, done: true, scanned: 5 });
        vi.setSystemTime(TENANCY_NOW + LONG_AGO);
        const oldSweep = yield* fixture.internal.mutation(prune.sweep, {
          cursor: null,
        });
        expect(oldSweep).toEqual({ deleted: 3, done: true, scanned: 5 });
        expect(
          Arr.map(yield* fixture.run(stepRows), (row) => row.version)
        ).toEqual([4, 5]);
      })
  );

  it.effect(
    "reads a log longer than one page in pages, starting the next page until the log is read",
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
        vi.setSystemTime(TENANCY_NOW + IDLE);
        yield* teacher.mutation(snapshots.save, {
          content: paragraphText("Soal"),
          documentId: made.id,
          slug: nf,
          version: 70,
        });
        vi.setSystemTime(TENANCY_NOW + LONG_AGO);
        const firstPage = yield* fixture.internal.mutation(prune.sweep, {
          cursor: null,
        });
        expect(firstPage).toMatchObject({ done: false, deleted: 64 });
        yield* fixture.finishScheduled();
        expect(yield* fixture.run(stepRows)).toEqual([]);
      })
  );

  it.effect(
    "prunes a covered step without reading the snapshot row of its document",
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
          batch: yield* batchText(0, "rina", 3),
          documentId: made.id,
          slug: nf,
        });
        vi.setSystemTime(TENANCY_NOW + IDLE);
        yield* teacher.mutation(snapshots.save, {
          content: paragraphText("Soal"),
          documentId: made.id,
          slug: nf,
          version: 3,
        });
        // The sweep reads the snapshot version of the document row. With the snapshot
        // row gone it still prunes, and a sweep that read the row would fail here.
        const [snapshot] = yield* fixture.run(snapshotRows);
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("editorSnapshots").delete(snapshot._id)
          )
        );
        vi.setSystemTime(TENANCY_NOW + LONG_AGO);
        const swept = yield* fixture.internal.mutation(prune.sweep, {
          cursor: null,
        });
        expect(swept).toEqual({ deleted: 3, done: true, scanned: 3 });
      })
  );

  it.effect(
    "keeps the record of a batch that landed, so a client away past the sweeps learns that it landed",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        const made = yield* teacher.mutation(documents.create, {
          content: paragraphText("Soal"),
          scope: { kind: "unit", unitId: fixture.units.smp },
          slug: nf,
        });
        // The reply to this batch is lost, so its client never learns that it landed.
        yield* teacher.mutation(steps.submit, {
          batch: yield* batchText(0, "rina", 3),
          documentId: made.id,
          slug: nf,
        });
        vi.setSystemTime(TENANCY_NOW + IDLE);
        yield* teacher.mutation(snapshots.save, {
          content: paragraphText("Soal"),
          documentId: made.id,
          slug: nf,
          version: 3,
        });
        vi.setSystemTime(TENANCY_NOW + LONG_AGO);
        yield* fixture.internal.mutation(prune.sweep, { cursor: null });
        expect(yield* fixture.run(stepRows)).toEqual([]);
        // The client comes back after the sweeps: its record still says that its batch
        // landed at version 3, so the client drops the batch and does not replay it.
        const reopened = yield* teacher.query(documents.open, {
          clientId: "rina",
          documentId: made.id,
          slug: nf,
        });
        expect(reopened.client).toMatchObject({ version: 3 });
        expect(yield* fixture.run(clientRows)).toHaveLength(1);
        const behind = yield* teacher.query(steps.since, {
          clientId: "rina",
          documentId: made.id,
          slug: nf,
          version: 0,
        });
        expect(behind).toMatchObject({
          _tag: "behind",
          client: { version: 3 },
        });
      })
  );

  it.effect("finds nothing to delete in an empty log", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const swept = yield* fixture.internal.mutation(prune.sweep, {
        cursor: null,
      });
      expect(swept).toEqual({ deleted: 0, done: true, scanned: 0 });
    })
  );
});
