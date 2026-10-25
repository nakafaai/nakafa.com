import { FunctionImpl, GroupImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { Document } from "@repo/backend/confect/editor/access";
import { documentAccess } from "@repo/backend/confect/editor/authority";
import { admitBatch, decodeBatch } from "@repo/backend/confect/editor/batch";
import { checkContent } from "@repo/backend/confect/editor/content";
import { DocumentInvalid } from "@repo/backend/confect/editor/document";
import { BatchInvalid, ClientTaken } from "@repo/backend/confect/editor/errors";
import { foldDue } from "@repo/backend/confect/editor/fold";
import { encodeStoredStep } from "@repo/backend/confect/editor/log";
import {
  decodedSteps,
  foldedText,
  pendingRows,
  stepBytes,
} from "@repo/backend/confect/editor/result";
import { STEP_PAGE_STEPS } from "@repo/backend/confect/editor/size";
import spec from "@repo/backend/confect/editor/steps.spec";
import {
  clientRecordOf,
  snapshotOf,
  stepsAfter,
} from "@repo/backend/confect/editor/store";
import {
  type ClientRecordView,
  clientView,
  type SinceReply,
  type StepView,
  stepView,
} from "@repo/backend/confect/editor/view";
import { requireDocumentUnfrozen } from "@repo/backend/confect/exams/freeze";
import member from "@repo/backend/confect/middleware/member.impl";
import session from "@repo/backend/confect/middleware/session.impl";
import { Array as Arr, Duration, Effect, Layer, Option } from "effect";

/** The reply that carries the steps the log still keeps after the version. */
const stepsReply = (
  client: typeof ClientRecordView.Type,
  steps: readonly (typeof StepView.Type)[]
): typeof SinceReply.Type => ({ _tag: "steps", client, steps });

/** The reply when the log has pruned a step the client needs: the client opens again from the snapshot. */
const behindReply = (
  client: typeof ClientRecordView.Type
): typeof SinceReply.Type => ({ _tag: "behind", client });

/**
 * The steps after a version, in order, one read's worth. The log keeps every step
 * after the snapshot and prunes the covered steps after a delay. So the first step
 * after the version is the next one only while the log still keeps it. When it is
 * missing, or when the version is behind the head with no step after it, the client
 * opens again from the snapshot. A sweep can also leave a gap further on, so the
 * reply stops at the first step that does not follow the one before it, and the
 * next read from there says `behind`. The reply carries the session's own record.
 */
const since = FunctionImpl.make(
  databaseSchema,
  spec,
  "since",
  Effect.fn("editor.steps.since")(function* ({ clientId, version }) {
    const document = yield* Document;
    const { appUser } = yield* requireAuth().pipe(Effect.orDie);
    const record = yield* clientRecordOf(document._id, clientId);
    const client = clientView(
      Option.filter(record, (own) => own.author === appUser._id)
    );
    if (version >= document.head) {
      return stepsReply(client, []);
    }
    const rows = yield* stepsAfter(document._id, version, STEP_PAGE_STEPS);
    const run = Arr.takeWhile(
      rows,
      (row, index) => row.version === version + index + 1
    );
    if (run.length === 0) {
      return behindReply(client);
    }
    return stepsReply(client, Arr.map(run, stepView));
  })
);

/**
 * Accepts a batch of steps made on the document's head. A batch the session has
 * had accepted before is answered without a write, so a retried batch is idempotent.
 * A session id that belongs to another author is refused with `ClientTaken`. A batch on the
 * prompt of a question whose exam a sitting has scheduled is refused with `ExamFrozen`, after a
 * retried batch is answered (ADR 0031). Any other batch is checked against the bounds, the
 * content the contract accepts, and the head.
 * The batch is then applied to the document as the server knows it, the snapshot with
 * the steps it lacks, with the model and the contract check that the fold uses. A result
 * the contract refuses fails with `DocumentInvalid` or `DocumentTooLarge`. So does a batch
 * step that nests the document past the bound, so the log holds no such step (ADR 0028).
 * A backlog that one read does not hold fails with `FoldPending`. Each step is then written
 * as one row at the version it produces, the head moves by the number of steps, and the
 * session's record takes the batch. All of it is one transaction, so two clients never win
 * one version: a stale batch writes nothing and fails with `VersionStale`. When the steps the
 * snapshot lacks reach a fold
 * limit with this batch, the batch also schedules the fold that writes the snapshot, so
 * the client never writes a snapshot (ADR 0028).
 */
const submit = FunctionImpl.make(
  databaseSchema,
  spec,
  "submit",
  Effect.fn("editor.steps.submit")(function* ({ batch: text }) {
    const document = yield* Document;
    const { appUser } = yield* requireAuth().pipe(Effect.orDie);
    const batch = yield* decodeBatch(text).pipe(
      Effect.catchTag("SchemaError", () => Effect.fail(new BatchInvalid()))
    );
    yield* checkContent(batch.steps);
    const record = yield* clientRecordOf(document._id, batch.clientId);
    if (Option.isSome(record) && record.value.author !== appUser._id) {
      return yield* new ClientTaken();
    }
    if (Option.isSome(record) && record.value.batch === batch.batch) {
      return null;
    }
    yield* requireDocumentUnfrozen(document._id);
    const admitted = yield* admitBatch(document.head, batch);
    const rows = yield* Effect.forEach(admitted.batch.steps, (step) =>
      encodeStoredStep({
        author: appUser._id,
        clientId: admitted.batch.clientId,
        step,
      }).pipe(Effect.orDie)
    );
    const snapshot = yield* snapshotOf(document._id);
    const pending = yield* pendingRows(
      document._id,
      snapshot.version,
      document.head
    );
    const folded = yield* foldedText(
      document._id,
      snapshot,
      Arr.appendAll(yield* decodedSteps(pending), admitted.batch.steps)
    );
    // A batch step that nests the document past the bound is refused, so the log holds no step
    // that every editor would skip for its depth (ADR 0028). A step that the schema cannot read,
    // or that ProseMirror does not apply, is stored and skipped, as every editor skips it.
    if (Arr.some(folded.tooDeep, (version) => version > document.head)) {
      return yield* new DocumentInvalid();
    }
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
    if (Option.isNone(record)) {
      yield* writer
        .table("editorClients")
        .insert({
          author: appUser._id,
          batch: batch.batch,
          clientId: batch.clientId,
          documentId: document._id,
          version: admitted.version,
        })
        .pipe(Effect.orDie);
    } else {
      yield* writer
        .table("editorClients")
        .patch(record.value._id, {
          batch: batch.batch,
          version: admitted.version,
        })
        .pipe(Effect.orDie);
    }
    const before = {
      bytes: stepBytes(pending),
      steps: document.head - snapshot.version,
    };
    const after = {
      bytes: before.bytes + stepBytes(rows),
      steps: admitted.version - snapshot.version,
    };
    if (foldDue({ after, before })) {
      yield* (yield* Scheduler).runAfter(
        Duration.zero,
        refs.internal.editor.fold.fold,
        { documentId: document._id }
      );
    }
    return null;
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
