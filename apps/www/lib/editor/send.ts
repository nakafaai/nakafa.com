import {
  BatchSchema,
  type BatchTooLarge,
  encodeBatch,
} from "@repo/backend/confect/editor/batch";
import { checkContent } from "@repo/backend/confect/editor/content";
import type {
  BatchInvalid,
  ClientTaken,
} from "@repo/backend/confect/editor/errors";
import { MAX_BATCH_STEPS } from "@repo/backend/confect/editor/size";
import { randomUuid } from "@repo/utilities/uuid";
import type { Step } from "@tiptap/pm/transform";
import { Array as Arr, Effect, Option, Ref, Schema } from "effect";
import { sendableSteps } from "prosemirror-collab";
import { dropUnsendable } from "@/lib/editor/replay";
import { SyncFailed, type SyncSession } from "@/lib/editor/session";

/** A batch as the loop encodes it: its text, and the number of steps the text holds. */
const FittedBatch = Schema.Struct({
  count: Schema.Natural,
  text: Schema.String,
});

/**
 * Encodes the longest prefix of the steps that one call may send: at most `count`
 * steps, under the byte bound, and with content the contract accepts. A prefix that is
 * too large, or that holds a step the contract refuses, halves until it fits. One step
 * that no call can carry fails with its refusal, and the loop drops that step, so a step
 * the server would refuse is never sent (ADR 0028). A step the batch schema refuses, such
 * as one nested deeper than the bound, is a failure too, so the editor can show it. The
 * result names the batch's text and the number of steps it holds.
 */
const fittingBatch = Effect.fn("editor.sync.batch")(function* (
  batchId: string,
  baseVersion: number,
  clientId: string,
  steps: readonly Step[],
  count: number
): Effect.fn.Return<
  typeof FittedBatch.Type,
  SyncFailed | BatchTooLarge | BatchInvalid
> {
  const batch = yield* Schema.decodeUnknownEffect(BatchSchema)({
    baseVersion,
    batch: batchId,
    clientId,
    steps: Arr.map(Arr.take(steps, count), (step) => step.toJSON()),
  }).pipe(
    Effect.mapError(
      () =>
        new SyncFailed({
          reason: "The server does not accept a step of this edit.",
        })
    )
  );
  const halve = (refusal: BatchTooLarge | BatchInvalid) =>
    count > 1
      ? fittingBatch(
          batchId,
          baseVersion,
          clientId,
          steps,
          Math.floor(count / 2)
        )
      : Effect.fail(refusal);
  return yield* checkContent(batch.steps).pipe(
    Effect.andThen(encodeBatch(batch)),
    Effect.map((text) => ({ count: batch.steps.length, text })),
    Effect.catchTags({
      // The batch was decoded just above, so the encoder cannot refuse its shape.
      SchemaError: Effect.die,
      BatchInvalid: halve,
      BatchTooLarge: halve,
    })
  );
});

/**
 * Sends the editor's unconfirmed steps on the version they were made on. A batch
 * whose call reached the server, or was refused, waits for the server's steps: the
 * next round sends nothing on that version. A batch whose call failed keeps its id
 * and its steps, and the next round sends the same batch, so the server answers a
 * repeat of a batch it has taken without writing it again. A batch on a version the
 * editor has moved past is replaced by a new one with a new id. A first step that no
 * call can carry, because it is too large or the contract refuses it, is dropped and
 * counted, and the steps after it are sent in the same round, so one such step never
 * blocks the later batches.
 */
export const push = Effect.fn("editor.sync.push")(function* (
  session: SyncSession
): Effect.fn.Return<void, SyncFailed | ClientTaken> {
  const state = yield* session.port.state;
  const sendable = sendableSteps(state);
  if (sendable === null) {
    yield* Ref.update(session.memory, (current) => ({
      ...current,
      batch: Option.none(),
    }));
    return;
  }
  const memory = yield* Ref.get(session.memory);
  const pending = Option.filter(
    memory.batch,
    (batch) => batch.version === sendable.version
  );
  if (Option.exists(pending, (batch) => batch.sent)) {
    return;
  }
  const id = yield* Option.match(pending, {
    onNone: () => randomUuid,
    onSome: (batch) => Effect.succeed(batch.id),
  });
  const count = Option.match(pending, {
    onNone: () => Math.min(sendable.steps.length, MAX_BATCH_STEPS),
    onSome: (batch) => batch.count,
  });
  const fitted = yield* fittingBatch(
    id,
    sendable.version,
    String(sendable.clientID),
    sendable.steps,
    count
  ).pipe(
    Effect.catchTags({
      BatchInvalid: () => Effect.succeed(null),
      BatchTooLarge: () => Effect.succeed(null),
    })
  );
  if (fitted === null) {
    yield* dropUnsendable(session);
    return yield* push(session);
  }
  yield* Ref.update(session.memory, (current) => ({
    ...current,
    batch: Option.some({
      count: fitted.count,
      id,
      sent: false,
      version: sendable.version,
    }),
  }));
  // The document would break the contract with this batch, so the batch is not accepted
  // (ADR 0028). The round halves it below and sends the first half.
  const refused = () => Effect.succeed(false);
  const accepted = yield* session.transport.submit(fitted.text).pipe(
    Effect.as(true),
    // A refused batch waits for the server's steps, and the next round sends nothing on
    // this version. A failure of the call is not caught here: the batch stays unsent, and
    // a batch that waits for a fold fails the round, so the next round sends it again.
    Effect.catchTag("VersionStale", () => Effect.succeed(true)),
    Effect.catchTags({
      DocumentInvalid: refused,
      DocumentTooLarge: refused,
      FoldPending: () =>
        Effect.fail(
          new SyncFailed({
            reason:
              "The server is folding this document. The steps are sent again shortly.",
          })
        ),
    })
  );
  if (!accepted) {
    yield* refusedBatch(session, fitted.count);
    return yield* push(session);
  }
  yield* Ref.update(session.memory, (current) => ({
    ...current,
    batch: Option.map(current.batch, (batch) => ({ ...batch, sent: true })),
  }));
});

/**
 * The server refused a batch because the document it would make breaks the contract
 * (ADR 0028). A batch of more than one step is halved under a new id, so the next round
 * sends the first half. A batch of one step is a step that the document refuses on its
 * own, so the loop drops it and counts it, as it drops a step no call can carry.
 */
const refusedBatch = Effect.fn("editor.sync.refused")(function* (
  session: SyncSession,
  count: number
) {
  if (count === 1) {
    return yield* dropUnsendable(session);
  }
  const id = yield* randomUuid;
  yield* Ref.update(session.memory, (current) => ({
    ...current,
    batch: Option.map(current.batch, (batch) => ({
      ...batch,
      count: Math.floor(count / 2),
      id,
      sent: false,
    })),
  }));
});
