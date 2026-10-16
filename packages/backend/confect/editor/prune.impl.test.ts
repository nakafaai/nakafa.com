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
    "deletes a session record a snapshot covers once the session was last submitted the keep delay ago",
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
        const young = yield* fixture.internal.mutation(prune.sweepClients, {
          cursor: null,
        });
        expect(young).toEqual({ deleted: 0, done: true, scanned: 1 });
        vi.setSystemTime(TENANCY_NOW + LONG_AGO);
        const old = yield* fixture.internal.mutation(prune.sweepClients, {
          cursor: null,
        });
        expect(old).toEqual({ deleted: 1, done: true, scanned: 1 });
        expect(yield* fixture.run(clientRows)).toEqual([]);
      })
  );

  it.effect(
    "keeps a session record whose version the snapshot does not cover, however old it is",
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
        yield* fixture.as("admin").mutation(steps.submit, {
          batch: yield* batchText(3, "hendra", 1),
          documentId: made.id,
          slug: nf,
        });
        vi.setSystemTime(TENANCY_NOW + LONG_AGO);
        const swept = yield* fixture.internal.mutation(prune.sweepClients, {
          cursor: null,
        });
        expect(swept).toEqual({ deleted: 1, done: true, scanned: 2 });
        expect(
          Arr.map(yield* fixture.run(clientRows), (row) => row.clientId)
        ).toEqual(["hendra"]);
      })
  );

  it.effect(
    "reads the session records in pages, starting the next page until the table is read",
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
        vi.setSystemTime(TENANCY_NOW + IDLE);
        yield* teacher.mutation(snapshots.save, {
          content: paragraphText("Soal"),
          documentId: made.id,
          slug: nf,
          version: 65,
        });
        vi.setSystemTime(TENANCY_NOW + LONG_AGO);
        const firstPage = yield* fixture.internal.mutation(prune.sweepClients, {
          cursor: null,
        });
        expect(firstPage).toMatchObject({ deleted: 64, done: false });
        yield* fixture.finishScheduled();
        expect(yield* fixture.run(clientRows)).toEqual([]);
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
