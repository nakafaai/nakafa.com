import type { GenericId } from "@confect/core";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { type Batch, encodeBatch } from "@repo/backend/confect/editor/batch";
import type { Step } from "@repo/backend/confect/editor/step";
import {
  grantRole,
  slugOf,
  TENANCY_NOW,
  type tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Schema } from "effect";

/** The school's address in every call of the editor tests. */
export const nf = slugOf("nf");

/** The fixture `tenancyFixture` seeds, which the editor tests extend. */
type Fixture = Effect.Success<typeof tenancyFixture>;

/** The access refusal of one reason, as a client decodes it. */
export const denied = (reason: "resource" | "role" | "condition") => ({
  _tag: "AccessDenied",
  code: "ACCESS_DENIED",
  reason,
});

/** Writes a value as its JSON text, the form a client sends a document or a batch in. */
export const encodeJson = Schema.encodeSync(
  Schema.fromJsonString(Schema.Unknown)
);

/** Reads a JSON text back into its value, so a test compares documents as values. */
export const jsonValue = Schema.decodeUnknownSync(
  Schema.fromJsonString(Schema.Unknown)
);

/** A document of one paragraph of one text, as the contract reads it. */
export const paragraphText = (text: string) =>
  encodeJson({
    content: [{ content: [{ text, type: "text" }], type: "paragraph" }],
    type: "doc",
  });

/**
 * A replace step that inserts one text node at the start of a document. The step
 * is well formed; the server stores it and does not apply it.
 */
export const insertStep = (text: string): Step => ({
  from: 1,
  slice: { content: [{ text, type: "text" }] },
  stepType: "replace",
  to: 1,
});

/**
 * The JSON text of one batch of `count` steps made on `baseVersion`, each of
 * `text` characters. A test that needs a large batch passes a long text.
 */
export const batchText = Effect.fn("test.editor.batchText")(function* (
  baseVersion: number,
  clientId: string,
  count: number,
  text = "x"
) {
  const batch: Batch = {
    baseVersion,
    clientId,
    steps: Arr.makeBy(count, () => insertStep(text)),
  };
  return yield* encodeBatch(batch).pipe(Effect.orDie);
});

/** The document row, read inside the fixture. */
export const storedDocument = (
  documentId: GenericId.GenericId<"editorDocuments">
) =>
  Effect.flatMap(DatabaseReader, (reader) =>
    reader.table("editorDocuments").get(documentId).pipe(Effect.orDie)
  );

/** Every document row, for a test that expects none or one. */
export const documentRows = Effect.flatMap(DatabaseReader, (reader) =>
  reader.table("editorDocuments").index("by_creation_time").take(100)
);

/** Every snapshot row, for a test that counts them. */
export const snapshotRows = Effect.flatMap(DatabaseReader, (reader) =>
  reader.table("editorSnapshots").index("by_creation_time").take(100)
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
