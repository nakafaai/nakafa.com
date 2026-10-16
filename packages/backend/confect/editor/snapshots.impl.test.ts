import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  CONVEX_DOCUMENT_LIMIT,
  MAX_DOCUMENT_BYTES,
  utf8Bytes,
} from "@repo/backend/confect/editor/size";
import {
  batchText,
  denied,
  encodeJson,
  jsonValue,
  nf,
  paragraphText,
  snapshotRows,
} from "@repo/backend/test/editor";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Duration, Effect } from "effect";

const documents = refs.public.editor.documents;
const steps = refs.public.editor.steps;
const snapshots = refs.public.editor.snapshots;

/** Past the idle delay, so a snapshot is due after the last step. */
const IDLE = Duration.toMillis(Duration.seconds(31));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TENANCY_NOW);
});

describe("editor/snapshots save", () => {
  it.effect(
    "saves a version the snapshot rule allows, and the new snapshot replaces the old",
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
        const saved = yield* teacher.mutation(snapshots.save, {
          content: paragraphText("Soal yang diperbarui"),
          documentId: made.id,
          slug: nf,
          version: 3,
        });
        const opened = yield* teacher.query(refs.public.editor.documents.open, {
          documentId: made.id,
          slug: nf,
        });
        expect(saved).toEqual({ version: 3 });
        expect(yield* fixture.run(snapshotRows)).toHaveLength(1);
        expect(opened.snapshot.version).toBe(3);
        expect(jsonValue(opened.snapshot.content)).toEqual(
          jsonValue(paragraphText("Soal yang diperbarui"))
        );
      })
  );

  it.effect(
    "refuses a version no newer than the stored snapshot, and a version past the head",
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
        const stale = yield* teacher
          .mutation(snapshots.save, {
            content: paragraphText("Soal"),
            documentId: made.id,
            slug: nf,
            version: 3,
          })
          .pipe(Effect.flip);
        const ahead = yield* teacher
          .mutation(snapshots.save, {
            content: paragraphText("Soal"),
            documentId: made.id,
            slug: nf,
            version: 4,
          })
          .pipe(Effect.flip);
        expect(stale).toMatchObject({
          _tag: "SnapshotRefused",
          code: "SNAPSHOT_REFUSED",
          reason: "stale",
        });
        expect(ahead).toMatchObject({
          _tag: "SnapshotRefused",
          reason: "ahead",
        });
      })
  );

  it.effect(
    "refuses a snapshot while the gap since the last one has not passed, and writes nothing",
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
        const notDue = yield* teacher
          .mutation(snapshots.save, {
            content: paragraphText("Soal"),
            documentId: made.id,
            slug: nf,
            version: 3,
          })
          .pipe(Effect.flip);
        expect(notDue).toMatchObject({
          _tag: "SnapshotRefused",
          reason: "notDue",
        });
        const stored = yield* fixture.run(snapshotRows);
        expect(Arr.map(stored, (row) => row.version)).toEqual([0]);
      })
  );

  it.effect(
    "refuses content the contract does not accept, and keeps the stored snapshot",
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
        const invalid = yield* teacher
          .mutation(snapshots.save, {
            content: encodeJson({ content: [], type: "doc" }),
            documentId: made.id,
            slug: nf,
            version: 3,
          })
          .pipe(Effect.flip);
        expect(invalid).toMatchObject({ _tag: "DocumentInvalid" });
        expect(
          Arr.map(yield* fixture.run(snapshotRows), (row) => row.version)
        ).toEqual([0]);
      })
  );

  it.effect(
    "refuses a snapshot whose complete row reaches one MiB though its text fits, and keeps the stored snapshot",
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
        const overhead = utf8Bytes(paragraphText(""));
        const tooLarge = yield* teacher
          .mutation(snapshots.save, {
            content: paragraphText("a".repeat(MAX_DOCUMENT_BYTES - overhead)),
            documentId: made.id,
            slug: nf,
            version: 3,
          })
          .pipe(Effect.flip);
        expect(tooLarge).toMatchObject({
          _tag: "DocumentTooLarge",
          limit: CONVEX_DOCUMENT_LIMIT,
        });
        expect(
          Arr.map(yield* fixture.run(snapshotRows), (row) => row.version)
        ).toEqual([0]);
      })
  );

  it.effect("refuses a student", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const made = yield* fixture.as("teacher").mutation(documents.create, {
        content: paragraphText("Soal"),
        scope: { kind: "unit", unitId: fixture.units.smp },
        slug: nf,
      });
      const refused = yield* fixture
        .as("student")
        .mutation(snapshots.save, {
          content: paragraphText("Soal"),
          documentId: made.id,
          slug: nf,
          version: 0,
        })
        .pipe(Effect.flip);
      expect(refused).toMatchObject(denied("role"));
    })
  );
});
