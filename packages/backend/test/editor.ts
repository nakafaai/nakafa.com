import type { GenericId } from "@confect/core";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type { AccessDenied } from "@repo/backend/confect/access/errors";
import { type Batch, encodeBatch } from "@repo/backend/confect/editor/batch";
import { STEP_KEEP_DELAY } from "@repo/backend/confect/editor/prune";
import { encodeStep, type Step } from "@repo/backend/confect/editor/step";
import { paragraphOf } from "@repo/backend/test/editor/nodes";
import {
  grantRole,
  slugOf,
  TENANCY_NOW,
  type tenancyFixture,
} from "@repo/backend/test/tenancy";
import { encodeJsonText, JsonTextSchema } from "@repo/utilities/json";
import { Array as Arr, Duration, Effect, Schema } from "effect";

/** The school's address in every call of the editor tests. */
export const nf = slugOf("nf");

/** The fixture `tenancyFixture` seeds, which the editor tests extend. */
type Fixture = Effect.Success<typeof tenancyFixture>;

/** The access refusal of one reason, as a client decodes it. */
export const denied = (reason: AccessDenied["reason"]) => ({
  _tag: "AccessDenied",
  code: "ACCESS_DENIED",
  reason,
});

/** Past the step keep delay by one minute, so every step a snapshot covers is old enough to prune. */
export const LONG_AGO = Duration.toMillis(
  Duration.sum(STEP_KEEP_DELAY, Duration.minutes(1))
);

/** Reads a JSON text back into its value, so a test compares documents as values. */
export const jsonValue = Schema.decodeUnknownSync(JsonTextSchema);

/** Creates a document in the SMP unit, as its teacher, and returns its ID. */
export const newDocument = Effect.fn("test.editor.newDocument")(function* (
  fixture: Fixture
) {
  const made = yield* fixture
    .as("teacher")
    .mutation(refs.public.editor.documents.create, {
      content: paragraphText("Soal"),
      scope: { kind: "unit", unitId: fixture.units.smp },
      slug: nf,
    });
  return made.id;
});

/** A document of one paragraph of one text, as the contract reads it, as JSON text. */
export const paragraphText = (text: string) =>
  encodeJsonText(paragraphOf(text));

/**
 * A replace step that inserts one text node at position 1, which is the start of the
 * first paragraph of a document of paragraphs. The step is well formed, and the fold
 * applies it, so the text lands in that paragraph.
 */
export const insertStep = (text: string): Step => ({
  from: 1,
  slice: { content: [{ text, type: "text" }] },
  stepType: "replace",
  to: 1,
});

/**
 * The JSON text of one batch of `count` steps made on `baseVersion`, each of
 * `text` characters. A test that needs a large batch passes a long text. The batch
 * id is derived from the arguments, so the same arguments make the same batch, and
 * a test that sends a batch again sends the same id.
 */
export const batchText = Effect.fn("test.editor.batchText")(function* (
  baseVersion: number,
  clientId: string,
  count: number,
  text = "x"
) {
  const batch: Batch = {
    baseVersion,
    batch: `${clientId}-${baseVersion}-${count}-${text.length}`,
    clientId,
    steps: Arr.makeBy(count, () => insertStep(text)),
  };
  return yield* encodeBatch(batch).pipe(Effect.orDie);
});

/**
 * Plants a stored step after the document's head, and moves the head to count it. A
 * stored step that a submit would refuse can only reach the log this way, so a test uses
 * it to prove the fold refuses such a step too (ADR 0028). The step is written by the
 * teacher's account and the client `crafted`.
 */
export const plantStep = Effect.fn("test.editor.plantStep")(function* (
  fixture: Effect.Success<typeof tenancyFixture>,
  documentId: GenericId.GenericId<"editorDocuments">,
  step: Step
) {
  yield* fixture.run(
    Effect.gen(function* () {
      const writer = yield* DatabaseWriter;
      const document = yield* documentRowOf(documentId);
      const version = document.head + 1;
      const text = yield* encodeStep(step).pipe(Effect.orDie);
      yield* writer
        .table("editorSteps")
        .insert({
          author: fixture.users.teacher.userId,
          clientId: "crafted",
          documentId,
          step: text,
          version,
        })
        .pipe(Effect.orDie);
      yield* writer
        .table("editorDocuments")
        .patch(documentId, { head: version })
        .pipe(Effect.orDie);
    })
  );
});

/** The document row, read inside the fixture. */
export const documentRowOf = Effect.fn("test.editor.documentRowOf")(function* (
  documentId: GenericId.GenericId<"editorDocuments">
) {
  return yield* (yield* DatabaseReader)
    .table("editorDocuments")
    .get(documentId)
    .pipe(Effect.orDie);
});

/** Every document row, for a test that expects none or one. */
export const documentRows = Effect.flatMap(DatabaseReader, (reader) =>
  reader.table("editorDocuments").index("by_creation_time").take(100)
);

/** Every snapshot row, for a test that counts them. */
export const snapshotRows = Effect.flatMap(DatabaseReader, (reader) =>
  reader.table("editorSnapshots").index("by_creation_time").take(100)
);

/** Every editor-session record, for a test that counts them. */
export const clientRows = Effect.flatMap(DatabaseReader, (reader) =>
  reader.table("editorClients").index("by_creation_time").take(100)
);

/** Every step row, for a test that counts them. */
export const stepRows = Effect.flatMap(DatabaseReader, (reader) =>
  reader.table("editorSteps").index("by_creation_time").take(1000)
);

/**
 * Makes a Person of another school a teacher of that school, with an account of
 * its own, and returns the client that account signs in with.
 */
export const otherSchoolTeacher = Effect.fn("test.editor.otherSchoolTeacher")(
  function* (fixture: Fixture) {
    const account = yield* fixture.account(
      "editor-other-teacher",
      "editor-other-teacher@example.com",
      true
    );
    const tenantId = fixture.tenants.other;
    yield* fixture.run(
      Effect.gen(function* () {
        const personId = yield* (yield* DatabaseWriter)
          .table("tenantPeople")
          .insert({
            account: {
              claimedAt: TENANCY_NOW,
              method: "invite",
              state: "claimed",
              userId: account.userId,
            },
            kind: "member",
            name: "Other Teacher",
            status: "active",
            tenantId,
          });
        yield* grantRole(tenantId, personId, "teacher", { kind: "tenant" });
      })
    );
    return account.client;
  }
);
