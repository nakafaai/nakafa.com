import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { MAX_BATCH_BYTES } from "@repo/backend/confect/editor/size";
import {
  batchText,
  denied,
  encodeJson,
  insertStep,
  nf,
  otherSchoolTeacher,
  paragraphText,
  stepRows,
  storedDocument,
} from "@repo/backend/test/editor";
import {
  slugOf,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Duration, Effect } from "effect";

const documents = refs.public.editor.documents;
const { since, submit } = refs.public.editor.steps;
const snapshots = refs.public.editor.snapshots;
const prune = refs.internal.editor.prune;
const other = slugOf("other");

/** One minute after the snapshot rule's idle delay, so a snapshot is due at once. */
const IDLE = Duration.toMillis(Duration.seconds(31));
/** Past the step keep delay, so every covered step is old enough to prune. */
const LONG_AGO = Duration.toMillis(Duration.minutes(11));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TENANCY_NOW);
});

/** Creates a document in the SMP unit, as its teacher, and returns its ID. */
const newDocument = Effect.fn("test.editor.steps.newDocument")(function* (
  fixture: Effect.Success<typeof tenancyFixture>
) {
  const made = yield* fixture.as("teacher").mutation(documents.create, {
    content: paragraphText("Soal"),
    scope: { kind: "unit", unitId: fixture.units.smp },
    slug: nf,
  });
  return made.id;
});

describe("editor/steps submit", () => {
  it.effect(
    "accepts a batch on the head, numbers its steps from the head, and moves the head",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const documentId = yield* newDocument(fixture);
        const text = yield* batchText(0, "rina", 3);
        const submitted = yield* fixture
          .as("teacher")
          .mutation(submit, { batch: text, documentId, slug: nf });
        const rows = yield* fixture.run(stepRows);
        expect(submitted).toEqual({ head: 3 });
        expect((yield* fixture.run(storedDocument(documentId))).head).toBe(3);
        expect(Arr.map(rows, (row) => row.version)).toEqual([1, 2, 3]);
        expect(Arr.map(rows, (row) => row.clientId)).toEqual([
          "rina",
          "rina",
          "rina",
        ]);
      })
  );

  it.effect(
    "refuses a batch on a document of an archived unit, writes nothing, and still reads its steps",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const documentId = yield* newDocument(fixture);
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer
              .table("tenantUnits")
              .patch(fixture.units.smp, { status: "archived" })
          )
        );
        const text = yield* batchText(0, "rina", 1);
        const refused = yield* fixture
          .as("teacher")
          .mutation(submit, { batch: text, documentId, slug: nf })
          .pipe(Effect.flip);
        const read = yield* fixture
          .as("teacher")
          .query(since, { documentId, slug: nf, version: 0 });
        expect(refused).toMatchObject(denied("condition"));
        expect(yield* fixture.run(stepRows)).toEqual([]);
        expect(read).toEqual({ _tag: "steps", head: 0, steps: [] });
      })
  );

  it.effect(
    "refuses a batch on a stale version with the head, and writes nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const documentId = yield* newDocument(fixture);
        yield* fixture.as("teacher").mutation(submit, {
          batch: yield* batchText(0, "rina", 3),
          documentId,
          slug: nf,
        });
        const stale = yield* fixture
          .as("teacher")
          .mutation(submit, {
            batch: yield* batchText(0, "hendra", 1),
            documentId,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(stale).toMatchObject({
          _tag: "VersionStale",
          baseVersion: 0,
          head: 3,
        });
        expect(yield* fixture.run(stepRows)).toHaveLength(3);
      })
  );

  it.effect(
    "admits exactly one of two batches that name the same version",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const documentId = yield* newDocument(fixture);
        const teacher = fixture.as("teacher");
        const first = yield* teacher
          .mutation(submit, {
            batch: yield* batchText(0, "rina", 2),
            documentId,
            slug: nf,
          })
          .pipe(Effect.exit);
        const second = yield* teacher
          .mutation(submit, {
            batch: yield* batchText(0, "hendra", 2),
            documentId,
            slug: nf,
          })
          .pipe(Effect.exit);
        expect([first._tag, second._tag]).toEqual(["Success", "Failure"]);
        expect(yield* fixture.run(stepRows)).toHaveLength(2);
      })
  );

  it.effect(
    "counts the version in steps, so a batch of two after three ends at five",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const documentId = yield* newDocument(fixture);
        const teacher = fixture.as("teacher");
        yield* teacher.mutation(submit, {
          batch: yield* batchText(0, "rina", 3),
          documentId,
          slug: nf,
        });
        const after = yield* teacher.mutation(submit, {
          batch: yield* batchText(3, "rina", 2),
          documentId,
          slug: nf,
        });
        expect(after).toEqual({ head: 5 });
      })
  );

  it.effect("refuses a batch that is not JSON, with BatchInvalid", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const documentId = yield* newDocument(fixture);
      const failure = yield* fixture
        .as("teacher")
        .mutation(submit, { batch: "{", documentId, slug: nf })
        .pipe(Effect.flip);
      expect(failure).toMatchObject({ _tag: "BatchInvalid" });
      expect(yield* fixture.run(stepRows)).toHaveLength(0);
    })
  );

  it.effect(
    "refuses a batch over the byte bound before it reads the batch",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const documentId = yield* newDocument(fixture);
        const text = encodeJson({
          baseVersion: 0,
          clientId: "rina",
          steps: [insertStep("x".repeat(MAX_BATCH_BYTES))],
        });
        const failure = yield* fixture
          .as("teacher")
          .mutation(submit, { batch: text, documentId, slug: nf })
          .pipe(Effect.flip);
        expect(failure).toMatchObject({
          _tag: "BatchTooLarge",
          limit: MAX_BATCH_BYTES,
        });
      })
  );

  it.effect(
    "refuses a student, and a teacher of another school, and writes nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const documentId = yield* newDocument(fixture);
        const student = yield* fixture
          .as("student")
          .mutation(submit, {
            batch: yield* batchText(0, "rina", 1),
            documentId,
            slug: nf,
          })
          .pipe(Effect.flip);
        const teacher = yield* otherSchoolTeacher(fixture);
        const foreign = yield* teacher
          .mutation(submit, {
            batch: yield* batchText(0, "rina", 1),
            documentId,
            slug: other,
          })
          .pipe(Effect.flip);
        expect([student, foreign]).toMatchObject([
          denied("role"),
          denied("resource"),
        ]);
        expect(yield* fixture.run(stepRows)).toHaveLength(0);
      })
  );
});

describe("editor/steps since", () => {
  it.effect(
    "returns the steps after a version in order, and says behind once the log pruned the first one it needs",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const documentId = yield* newDocument(fixture);
        const teacher = fixture.as("teacher");
        yield* teacher.mutation(submit, {
          batch: yield* batchText(0, "rina", 3),
          documentId,
          slug: nf,
        });
        vi.setSystemTime(TENANCY_NOW + IDLE);
        yield* teacher.mutation(snapshots.save, {
          content: paragraphText("Soal"),
          documentId,
          slug: nf,
          version: 3,
        });
        yield* teacher.mutation(submit, {
          batch: yield* batchText(3, "rina", 2),
          documentId,
          slug: nf,
        });
        vi.setSystemTime(TENANCY_NOW + LONG_AGO);
        yield* fixture.internal.mutation(prune.sweep, { cursor: null });
        const behind = yield* teacher.query(since, {
          documentId,
          slug: nf,
          version: 0,
        });
        const after = yield* teacher.query(since, {
          documentId,
          slug: nf,
          version: 3,
        });
        const atHead = yield* teacher.query(since, {
          documentId,
          slug: nf,
          version: 5,
        });
        expect(behind).toEqual({ _tag: "behind", head: 5 });
        expect(after).toEqual({
          _tag: "steps",
          head: 5,
          steps: [
            { clientId: "rina", step: expect.any(String), version: 4 },
            { clientId: "rina", step: expect.any(String), version: 5 },
          ],
        });
        expect(atHead).toEqual({ _tag: "steps", head: 5, steps: [] });
      })
  );

  it.effect(
    "says behind when the log keeps no step after the version, though the document has moved on",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const documentId = yield* newDocument(fixture);
        const teacher = fixture.as("teacher");
        yield* teacher.mutation(submit, {
          batch: yield* batchText(0, "rina", 3),
          documentId,
          slug: nf,
        });
        vi.setSystemTime(TENANCY_NOW + IDLE);
        yield* teacher.mutation(snapshots.save, {
          content: paragraphText("Soal"),
          documentId,
          slug: nf,
          version: 3,
        });
        vi.setSystemTime(TENANCY_NOW + LONG_AGO);
        yield* fixture.internal.mutation(prune.sweep, { cursor: null });
        expect(yield* fixture.run(stepRows)).toEqual([]);
        const behind = yield* teacher.query(since, {
          documentId,
          slug: nf,
          version: 0,
        });
        expect(behind).toEqual({ _tag: "behind", head: 3 });
      })
  );

  it.effect(
    "reads a log past one byte budget in parts, and the client reads on from its last version",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const documentId = yield* newDocument(fixture);
        const teacher = fixture.as("teacher");
        const large = "x".repeat(120_000);
        for (const version of Arr.makeBy(6, (index) => index)) {
          yield* teacher.mutation(submit, {
            batch: yield* batchText(version, "rina", 1, large),
            documentId,
            slug: nf,
          });
        }
        const first = yield* teacher.query(since, {
          documentId,
          slug: nf,
          version: 0,
        });
        expect(first).toMatchObject({ _tag: "steps", head: 6 });
        const read = first._tag === "steps" ? first.steps : [];
        expect(read.length).toBeGreaterThan(0);
        expect(read.length).toBeLessThan(6);
        const resume = Arr.reduce(read, 0, (_, step) => step.version);
        const rest = yield* teacher.query(since, {
          documentId,
          slug: nf,
          version: resume,
        });
        const restSteps = rest._tag === "steps" ? rest.steps : [];
        expect([
          ...Arr.map(read, (step) => step.version),
          ...Arr.map(restSteps, (step) => step.version),
        ]).toEqual([1, 2, 3, 4, 5, 6]);
      })
  );
});
