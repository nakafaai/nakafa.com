import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { Document } from "@repo/backend/confect/editor/access";
import { documentAccess } from "@repo/backend/confect/editor/authority";
import { admitBatch } from "@repo/backend/confect/editor/batch";
import { BatchInvalid } from "@repo/backend/confect/editor/errors";
import { encodeStoredStep } from "@repo/backend/confect/editor/log";
import spec from "@repo/backend/confect/editor/steps.spec";
import { stepsAfter } from "@repo/backend/confect/editor/store";
import {
  type SinceReply,
  type StepView,
  stepView,
} from "@repo/backend/confect/editor/view";
import member from "@repo/backend/confect/middleware/member.impl";
import session from "@repo/backend/confect/middleware/session.impl";
import { Array as Arr, Effect, Layer, Option } from "effect";

/** The reply that carries the head and the steps the log still keeps after the version. */
const stepsReply = (
  head: number,
  steps: readonly (typeof StepView.Type)[]
): typeof SinceReply.Type => ({ _tag: "steps", head, steps });

/** The reply when the log has pruned a step the client needs: the client opens again from the snapshot. */
const behindReply = (head: number): typeof SinceReply.Type => ({
  _tag: "behind",
  head,
});

/**
 * The steps after a version, in order, one read's worth. The log keeps every step
 * after the snapshot and prunes the covered steps after a delay. So the first step
 * after the version is the next one only while the log still keeps it. When it is
 * missing, or when the version is behind the head with no step after it, the client
 * opens again from the snapshot.
 */
const since = FunctionImpl.make(
  databaseSchema,
  spec,
  "since",
  Effect.fn("editor.steps.since")(function* ({ version }) {
    const document = yield* Document;
    if (version >= document.head) {
      return stepsReply(document.head, []);
    }
    const { steps: rows } = yield* stepsAfter(document._id, version);
    const kept = Option.match(Arr.head(rows), {
      onNone: () => false,
      onSome: (first) => first.version === version + 1,
    });
    if (!kept) {
      return behindReply(document.head);
    }
    return stepsReply(document.head, Arr.map(rows, stepView));
  })
);

/**
 * Accepts a batch of steps made on the document's head. The batch is checked
 * against the bounds and the head, then each step is written as one row at the
 * version it produces, and the head moves by the number of steps. All of it is
 * one transaction, so two clients never win one version: a stale batch writes
 * nothing and fails with `VersionStale`.
 */
const submit = FunctionImpl.make(
  databaseSchema,
  spec,
  "submit",
  Effect.fn("editor.steps.submit")(function* ({ batch }) {
    const document = yield* Document;
    const { appUser } = yield* requireAuth().pipe(Effect.orDie);
    const admitted = yield* admitBatch(document.head, batch).pipe(
      Effect.catchTag("SchemaError", () => Effect.fail(new BatchInvalid()))
    );
    const rows = yield* Effect.forEach(admitted.batch.steps, (step) =>
      encodeStoredStep({
        author: appUser._id,
        clientId: admitted.batch.clientId,
        step,
      }).pipe(Effect.orDie)
    );
    const writer = yield* DatabaseWriter;
    yield* Effect.forEach(
      rows,
      (row, index) =>
        writer
          .table("editorSteps")
          .insert({
            ...row,
            documentId: document._id,
            version: document.head + index + 1,
          })
          .pipe(Effect.orDie),
      { discard: true }
    );
    yield* writer
      .table("editorDocuments")
      .patch(document._id, { head: admitted.version })
      .pipe(Effect.orDie);
    return { head: admitted.version };
  })
);

/**
 * Implements the steps group of `steps.spec.ts`: the steps after a version, and a
 * submit. The document access check provides the document to both.
 */
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(since),
  Layer.provide(submit),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(documentAccess),
  GroupImpl.finalize
);
