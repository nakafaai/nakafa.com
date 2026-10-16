import { BatchSchema, encodeBatch } from "@repo/backend/confect/editor/batch";
import { MAX_BATCH_STEPS } from "@repo/backend/confect/editor/size";
import { randomUuid } from "@repo/utilities/uuid";
import type { Step } from "@tiptap/pm/transform";
import { Array as Arr, Effect, Option, Ref, Schema } from "effect";
import { sendableSteps } from "prosemirror-collab";
import { nowTime, SyncFailed, type SyncSession } from "@/lib/editor/session";

/** A batch as the loop encodes it: its text, and the number of steps the text holds. */
const FittedBatch = Schema.Struct({
  count: Schema.Natural,
  text: Schema.String,
});

/**
 * Encodes the longest prefix of the steps that one call may send: at most `count`
 * steps, and under the byte bound. A prefix that is too large halves, until it fits.
 * One step too large for one call is a failure, because no prefix of it can be sent.
 * A step the batch schema refuses, such as one nested deeper than the bound, is a
 * failure too, so the editor can show it. The result names the batch's text and the
 * number of steps it holds.
 */
const fittingBatch = Effect.fn("editor.sync.batch")(function* (
  batchId: string,
  baseVersion: number,
  clientId: string,
  steps: readonly Step[],
  count: number
): Effect.fn.Return<typeof FittedBatch.Type, SyncFailed> {
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
  return yield* encodeBatch(batch).pipe(
    Effect.map((text) => ({ count: batch.steps.length, text })),
    Effect.catchTags({
      // The batch was decoded just above, so the encoder cannot refuse its shape.
      SchemaError: Effect.die,
      BatchTooLarge: (tooLarge) =>
        count > 1
          ? fittingBatch(
              batchId,
              baseVersion,
              clientId,
              steps,
              Math.floor(count / 2)
            )
          : Effect.fail(
              new SyncFailed({
                reason: `One step takes ${tooLarge.bytes} bytes, more than one call may send.`,
              })
            ),
    })
  );
});

/**
 * Sends the editor's unconfirmed steps on the version they were made on. A batch
 * whose call reached the server, or was refused, waits for the server's steps: the
 * next round sends nothing on that version. A batch whose call failed keeps its id
 * and its steps, and the next round sends the same batch, so the server answers a
 * repeat of a batch it has taken without writing it again. A batch on a version the
 * editor has moved past is replaced by a new one with a new id.
 */
export const push = Effect.fn("editor.sync.push")(function* (
  session: SyncSession
) {
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
  const now = yield* nowTime;
  const fitted = yield* fittingBatch(
    id,
    sendable.version,
    String(sendable.clientID),
    sendable.steps,
    count
  );
  yield* Ref.update(session.memory, (current) => ({
    ...current,
    batch: Option.some({
      count: fitted.count,
      id,
      sent: false,
      version: sendable.version,
    }),
    lastChangeAt: now,
  }));
  const head = yield* session.transport.submit(fitted.text).pipe(
    Effect.map((accepted) => accepted.head),
    // A refused batch waits for the server's steps, and the next round sends nothing on
    // this version. A failure of the call is not caught here: the batch stays unsent.
    Effect.catchTag("VersionStale", () => Effect.succeed(null))
  );
  yield* Ref.update(session.memory, (current) => ({
    ...current,
    batch: Option.map(current.batch, (batch) => ({ ...batch, sent: true })),
    head: head ?? current.head,
  }));
});
