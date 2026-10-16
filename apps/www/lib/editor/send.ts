import { BatchSchema, encodeBatch } from "@repo/backend/confect/editor/batch";
import { MAX_BATCH_STEPS } from "@repo/backend/confect/editor/size";
import type { Step } from "@tiptap/pm/transform";
import { Array as Arr, Effect, Option, Ref, Schema } from "effect";
import { sendableSteps } from "prosemirror-collab";
import { nowTime, SyncFailed, type SyncSession } from "@/lib/editor/session";

/**
 * Encodes the longest prefix of the steps that one call may send: at most
 * `MAX_BATCH_STEPS`, and under the byte bound. A prefix that is too large halves,
 * until it fits. One step too large for one call is a failure, because no prefix
 * of it can be sent. A step the batch schema refuses, such as one nested deeper
 * than the bound, is a failure too, so the editor can show it.
 */
const fittingBatch = Effect.fn("editor.sync.batch")(function* (
  baseVersion: number,
  clientId: string,
  steps: readonly Step[],
  count: number
): Effect.fn.Return<string, SyncFailed> {
  const batch = yield* Schema.decodeUnknownEffect(BatchSchema)({
    baseVersion,
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
    Effect.catchTags({
      // The batch was decoded just above, so the encoder cannot refuse its shape.
      SchemaError: Effect.die,
      BatchTooLarge: (tooLarge) =>
        count > 1
          ? fittingBatch(baseVersion, clientId, steps, Math.floor(count / 2))
          : Effect.fail(
              new SyncFailed({
                reason: `One step takes ${tooLarge.bytes} bytes, more than one call may send.`,
              })
            ),
    })
  );
});

/**
 * Sends the editor's unconfirmed steps on the version they were made on, unless a
 * batch on that version is in flight or refused. Any failure before the call clears
 * the mark, so the next round tries again and the failure is not silent.
 */
export const push = Effect.fn("editor.sync.push")(function* (
  session: SyncSession
) {
  const state = yield* session.port.state;
  const sendable = sendableSteps(state);
  if (sendable === null) {
    return;
  }
  const memory = yield* Ref.get(session.memory);
  if (Option.exists(memory.blockedAt, (at) => at === sendable.version)) {
    return;
  }
  const now = yield* nowTime;
  yield* Ref.update(session.memory, (current) => ({
    ...current,
    blockedAt: Option.some(sendable.version),
    lastChangeAt: now,
  }));
  const batch = yield* fittingBatch(
    sendable.version,
    String(sendable.clientID),
    sendable.steps,
    Math.min(sendable.steps.length, MAX_BATCH_STEPS)
  ).pipe(
    Effect.tapError(() =>
      Ref.update(session.memory, (current) => ({
        ...current,
        blockedAt: Option.none(),
      }))
    )
  );
  yield* session.transport.submit(batch).pipe(
    // An accepted batch tells the editor the server's head now, before its own steps
    // come back through the subscription.
    Effect.tap(({ head }) =>
      Ref.update(session.memory, (current) => ({ ...current, head }))
    ),
    Effect.catchTags({
      VersionStale: () => Effect.void,
      // The batch may not have reached the server, and the version has not moved,
      // so the next tick may send it again. The server refuses a repeat after success.
      SyncFailed: (failure) =>
        Ref.update(session.memory, (current) => ({
          ...current,
          blockedAt: Option.none(),
        })).pipe(Effect.andThen(Effect.fail(failure))),
    })
  );
});
