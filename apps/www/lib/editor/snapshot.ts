import { snapshotDue } from "@repo/backend/confect/editor/snapshot";
import { JsonTextSchema } from "@repo/utilities/json";
import { Effect, Option, Ref, Schema } from "effect";
import { getVersion, sendableSteps } from "prosemirror-collab";
import { nowTime, type SyncSession } from "@/lib/editor/session";

/**
 * Saves the document at the editor's version when nothing is unconfirmed and the
 * snapshot rule of ADR 0028 allows one now. A refusal from the server is not an
 * error: the next save waits for the rule again, so a refused save is not retried
 * on every tick.
 */
export const snapshotIfDue = Effect.fn("editor.sync.snapshot")(function* (
  session: SyncSession
) {
  const state = yield* session.port.state;
  if (sendableSteps(state) !== null) {
    return;
  }
  const memory = yield* Ref.get(session.memory);
  const now = yield* nowTime;
  const due = snapshotDue({
    lastSnapshotAt: memory.snapshotAt,
    lastStepAt: memory.lastChangeAt,
    now,
    stepsSince: memory.head - memory.snapshotVersion,
  });
  if (!due) {
    return;
  }
  const version = getVersion(state);
  const content = yield* Schema.encodeEffect(JsonTextSchema)(
    state.doc.toJSON()
  ).pipe(Effect.orDie);
  const saved = yield* session.transport.save({ content, version }).pipe(
    Effect.as(true),
    Effect.catchTag("SnapshotRefused", () => Effect.succeed(false))
  );
  yield* Ref.update(session.memory, (current) =>
    saved
      ? { ...current, snapshotAt: Option.some(now), snapshotVersion: version }
      : { ...current, snapshotAt: Option.some(now) }
  );
});
