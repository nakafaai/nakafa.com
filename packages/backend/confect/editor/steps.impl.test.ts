import type { GenericId } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { MAX_BATCH_BYTES } from "@repo/backend/confect/editor/size";
import type { SinceReply } from "@repo/backend/confect/editor/view";
import {
  batchText,
  clientRows,
  denied,
  documentRowOf,
  insertStep,
  LONG_AGO,
  newDocument,
  nf,
  otherSchoolTeacher,
  stepRows,
} from "@repo/backend/test/editor";
import {
  slugOf,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Effect } from "effect";

const { since, submit } = refs.public.editor.steps;
const fold = refs.internal.editor.fold.fold;
const prune = refs.internal.editor.prune;
const other = slugOf("other");

type Fixture = Effect.Success<typeof tenancyFixture>;
type Account = Parameters<Fixture["as"]>[0];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TENANCY_NOW);
});

/**
 * The steps of a reply that carries them. A `behind` reply is a failed read, so the
 * test names the reply it did not expect instead of comparing against an empty list.
 */
const stepsOf = Effect.fn("test.editor.steps.stepsOf")(function* (
  reply: typeof SinceReply.Type
) {
  if (reply._tag === "behind") {
    return yield* Effect.die("The read says behind.");
  }
  return reply.steps;
});

/** Reads the steps after `version` of the session "rina", as the account reads them. */
const readSince = Effect.fn("test.editor.steps.readSince")(function* (
  fixture: Fixture,
  account: Account,
  documentId: GenericId.GenericId<"editorDocuments">,
  version: number
) {
  return yield* fixture
    .as(account)
    .query(since, { clientId: "rina", documentId, slug: nf, version });
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
        expect(submitted).toBeNull();
        expect((yield* fixture.run(documentRowOf(documentId))).head).toBe(3);
        expect(Arr.map(rows, (row) => row.version)).toEqual([1, 2, 3]);
        expect(Arr.map(rows, (row) => row.clientId)).toEqual([
          "rina",
          "rina",
          "rina",
        ]);
      })
  );

  it.effect(
    "records the session of the batch: its batch id, its version, and its author",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const documentId = yield* newDocument(fixture);
        yield* fixture.as("teacher").mutation(submit, {
          batch: yield* batchText(0, "rina", 3),
          documentId,
          slug: nf,
        });
        const [record] = yield* fixture.run(clientRows);
        expect(record).toMatchObject({
          author: fixture.users.teacher.userId,
          batch: "rina-0-3-1",
          clientId: "rina",
          documentId,
          version: 3,
        });
      })
  );

  it.effect("answers a retried batch with nothing, and writes nothing", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const documentId = yield* newDocument(fixture);
      const teacher = fixture.as("teacher");
      const text = yield* batchText(0, "rina", 2);
      yield* teacher.mutation(submit, { batch: text, documentId, slug: nf });
      const retried = yield* teacher.mutation(submit, {
        batch: text,
        documentId,
        slug: nf,
      });
      expect(retried).toBeNull();
      expect(yield* fixture.run(stepRows)).toHaveLength(2);
      expect((yield* fixture.run(documentRowOf(documentId))).head).toBe(2);
    })
  );

  it.effect(
    "refuses a batch on a document of an archived unit, and writes nothing",
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
        expect(refused).toMatchObject(denied("condition"));
        expect(yield* fixture.run(stepRows)).toEqual([]);
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
    "refuses a batch under another author's session id with ClientTaken, and writes nothing",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const documentId = yield* newDocument(fixture);
        yield* fixture.as("teacher").mutation(submit, {
          batch: yield* batchText(0, "rina", 1),
          documentId,
          slug: nf,
        });
        const taken = yield* fixture
          .as("admin")
          .mutation(submit, {
            batch: yield* batchText(1, "rina", 1, "y"),
            documentId,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(taken).toMatchObject({
          _tag: "ClientTaken",
          code: "CLIENT_TAKEN",
        });
        expect(yield* fixture.run(stepRows)).toHaveLength(1);
        expect(yield* fixture.run(clientRows)).toHaveLength(1);
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
        expect(after).toBeNull();
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
        const text = encodeJsonText({
          baseVersion: 0,
          batch: "rina-big",
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
        yield* fixture.internal.mutation(fold, { documentId });
        yield* teacher.mutation(submit, {
          batch: yield* batchText(3, "rina", 2),
          documentId,
          slug: nf,
        });
        vi.setSystemTime(TENANCY_NOW + LONG_AGO);
        yield* fixture.internal.mutation(prune.sweep, { cursor: null });
        const behind = yield* readSince(fixture, "teacher", documentId, 0);
        const after = yield* readSince(fixture, "teacher", documentId, 3);
        const atHead = yield* readSince(fixture, "teacher", documentId, 5);
        expect(behind).toEqual({
          _tag: "behind",
          client: { batch: "rina-3-2-1", version: 5 },
        });
        expect(after).toEqual({
          _tag: "steps",
          client: { batch: "rina-3-2-1", version: 5 },
          steps: [
            { clientId: "rina", step: expect.any(String), version: 4 },
            { clientId: "rina", step: expect.any(String), version: 5 },
          ],
        });
        expect(atHead).toEqual({
          _tag: "steps",
          client: { batch: "rina-3-2-1", version: 5 },
          steps: [],
        });
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
        yield* fixture.internal.mutation(fold, { documentId });
        vi.setSystemTime(TENANCY_NOW + LONG_AGO);
        yield* fixture.internal.mutation(prune.sweep, { cursor: null });
        expect(yield* fixture.run(stepRows)).toEqual([]);
        const behind = yield* readSince(fixture, "teacher", documentId, 0);
        expect(behind).toEqual({
          _tag: "behind",
          client: { batch: "rina-0-3-1", version: 3 },
        });
      })
  );

  it.effect(
    "answers the caller's own session record, and none of another author's session",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const documentId = yield* newDocument(fixture);
        yield* fixture.as("teacher").mutation(submit, {
          batch: yield* batchText(0, "rina", 1),
          documentId,
          slug: nf,
        });
        const own = yield* readSince(fixture, "teacher", documentId, 1);
        const theirs = yield* readSince(fixture, "admin", documentId, 1);
        expect(own).toMatchObject({
          client: { batch: "rina-0-1-1", version: 1 },
        });
        expect(theirs).toMatchObject({ client: null });
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
        const first = yield* readSince(fixture, "teacher", documentId, 0);
        expect(first).toMatchObject({ _tag: "steps" });
        const read = yield* stepsOf(first);
        expect(read.length).toBeGreaterThan(0);
        expect(read.length).toBeLessThan(6);
        const resume = Arr.reduce(read, 0, (_, step) => step.version);
        const rest = yield* readSince(fixture, "teacher", documentId, resume);
        const restSteps = yield* stepsOf(rest);
        expect([
          ...Arr.map(read, (step) => step.version),
          ...Arr.map(restSteps, (step) => step.version),
        ]).toEqual([1, 2, 3, 4, 5, 6]);
      })
  );

  it.effect(
    "returns the steps up to a gap the log holds, and says behind at the gap",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const documentId = yield* newDocument(fixture);
        yield* fixture.as("teacher").mutation(submit, {
          batch: yield* batchText(0, "rina", 5),
          documentId,
          slug: nf,
        });
        // A sweep of two pages can keep a step below one it deleted, so the log
        // holds a gap at version 3 while the head is at 5.
        const rows = yield* fixture.run(stepRows);
        const dropped = yield* Effect.fromOption(
          Arr.findFirst(rows, (row) => row.version === 3)
        );
        yield* fixture.run(
          Effect.flatMap(DatabaseWriter, (writer) =>
            writer.table("editorSteps").delete(dropped._id)
          )
        );
        const beforeGap = yield* readSince(fixture, "teacher", documentId, 0);
        const atGap = yield* readSince(fixture, "teacher", documentId, 2);
        expect(beforeGap).toMatchObject({
          _tag: "steps",
          steps: [
            { clientId: "rina", step: expect.any(String), version: 1 },
            { clientId: "rina", step: expect.any(String), version: 2 },
          ],
        });
        expect(atGap).toMatchObject({ _tag: "behind" });
      })
  );
});
