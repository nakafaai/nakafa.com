import { abortStream, listStreams } from "@convex-dev/agent";
import { components } from "@repo/backend/confect/_generated/components";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import users from "@repo/backend/confect/_generated/tables/users";
import { storedBytes } from "@repo/backend/confect/nina/sealed/bytes";
import {
  placeRows,
  readTurnRows,
  type SettledTurn,
  TurnSealError,
  writeRuns,
} from "@repo/backend/confect/nina/sealed/rows";
import { SealUnavailable } from "@repo/backend/confect/nina/sealed.spec";
import type { NinaSealHold } from "@repo/backend/confect/nina/turns.spec";
import { ensureLearnerKeys } from "@repo/backend/confect/vault/keys";
import { Array as Arr, Clock, Effect, Schema } from "effect";

/** Why the seal skips a turn on purpose: the turn is then never sealed by the sweep. */
type SealHold = typeof NinaSealHold.Type;

/**
 * How long a run may live, counted from the row it wrote (ADR 0024). A Convex action
 * lives at most 30 minutes in the Convex runtime and 10 minutes in the Node runtime
 * (https://docs.convex.dev/production/state/limits), and Nina's answer action runs in
 * Node (`convex/nina/response.ts`). The seal takes the longer limit, so that no live
 * run is judged dead: a pending row younger than this may still belong to one.
 */
export const RUN_LIFETIME_MS = 30 * 60_000;

/**
 * Marks a settled turn that the seal skips on purpose, so the sweep never takes it
 * again. Its plain rows stay readable. Returns the bytes of the write.
 */
const hold = Effect.fn("nina.sealed.turn.hold")(function* (
  turn: SettledTurn,
  reason: SealHold
) {
  const held = { ...turn, sealHold: reason };
  yield* (yield* DatabaseWriter)
    .table("ninaTurns")
    .replace(turn._id, held)
    .pipe(Effect.orDie);
  return storedBytes(held);
});

/**
 * Seals the rows of one settled turn and deletes the deltas of its streams (ADR
 * 0024). Its assistant and tool rows are deleted and written again sealed, at the
 * steps they take now, with the same order, and the turn records `sealedAt` in the
 * same transaction. The deltas go page by page. A turn that is not settled, or that
 * already carries `sealedAt`, is left alone, so a retry does no harm. A turn whose
 * chat or learner is gone, or whose prompt is not at its order, is marked with a
 * `sealHold`, so the sweep never takes it again.
 *
 * The prompt is not written again: the seal reads its order and does not open it. A
 * turn admitted before wave two keeps a plain prompt until the migration wave of ADR
 * 0024 seals it. A pending row younger than `RUN_LIFETIME_MS` may still belong to a
 * live run, so the seal writes nothing and returns, and the sweep takes the turn again
 * in a later run. An older pending row belongs to a run that has ended, so the seal
 * writes it as failed.
 *
 * Returns the bytes the seal read and wrote: every document it reads at its stored
 * size, every row it deletes twice, and every row it writes once (`sealed/bytes.ts`).
 * The keys of the learner, the deltas it deletes later and the component's index
 * entries are not counted. It fails with `SealUnavailable` only when the key ring
 * cannot be read: `VAULT_ROOT_KEYS` is missing or malformed, a root key cannot be
 * derived, or a stored key names a root key that the ring does not hold. That blames
 * no turn.
 */
export const sealTurn = Effect.fn("nina.sealed.turn")(function* (
  turnId: Docs["ninaTurns"]["_id"]
) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const ctx = yield* MutationCtx;
  const cost = { bytes: 0 };
  const turn = yield* reader
    .table("ninaTurns")
    .get(turnId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  cost.bytes += storedBytes(turn);
  if (turn?.phase !== "settled" || turn.sealedAt !== undefined) {
    return cost.bytes;
  }
  const chat = yield* reader
    .table("chats")
    .get(turn.chatId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  cost.bytes += storedBytes(chat);
  if (!chat) {
    return cost.bytes + (yield* hold(turn, "chatDeleted"));
  }
  const user = yield* reader
    .table("users")
    .get(turn.userId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  // The learner counts at the size the database stores, as ADR 0024 names. The seal
  // reads the document decoded, where the mascot is an object, so it is encoded back
  // to the stored form, with the system fields that the table's `Doc` adds.
  const storedUser =
    user === null
      ? null
      : yield* Schema.encodeEffect(users.Doc)(user).pipe(Effect.orDie);
  cost.bytes += storedBytes(storedUser);
  if (!user || user.deletedAt !== undefined) {
    return cost.bytes + (yield* hold(turn, "accountDeleted"));
  }
  // `configuration` is the key ring's fault (`vault/schema.ts`): `VAULT_ROOT_KEYS` is
  // missing or malformed, or a stored key names a root key that the ring does not hold.
  // Every other vault failure is charged to the turn, as a failed seal (ADR 0024).
  const keys = yield* ensureLearnerKeys(turn.userId).pipe(
    Effect.catchTag("VaultError", (error) =>
      error.reason === "configuration"
        ? Effect.fail(new SealUnavailable())
        : Effect.die(error)
    )
  );
  // The prompt keeps its order in the clear, so the seal checks its place and does not
  // open its content. Opening it would read the learner's key a second time.
  const [prompt] = yield* Effect.promise(() =>
    ctx.runQuery(components.nina.messages.getMessagesByIds, {
      messageIds: [turn.promptMessageId],
    })
  );
  cost.bytes += storedBytes(prompt);
  if (prompt?.order !== turn.order) {
    return cost.bytes + (yield* hold(turn, "promptMissing"));
  }
  const { rows, stored } = yield* readTurnRows(ctx, turn, keys, cost);
  const now = yield* Clock.currentTimeMillis;
  // A pending row younger than a run can live may still be written by a live run, so
  // the turn waits for a later run. An older one has no live run behind it.
  if (
    Arr.some(
      rows,
      (row) =>
        row.status === "pending" && now - row._creationTime <= RUN_LIFETIME_MS
    )
  ) {
    return cost.bytes;
  }
  // A run that still streams at this order is stopped first, as a settlement stops
  // it, so no delta is written after the streams are read.
  yield* Effect.promise(() =>
    abortStream(ctx, components.nina, {
      order: turn.order,
      reason: "Turn settled",
      threadId: turn.threadId,
    })
  );
  const listed = yield* Effect.promise(() =>
    listStreams(ctx, components.nina, {
      includeStatuses: ["streaming", "finished", "aborted"],
      startOrder: turn.order,
      threadId: turn.threadId,
    })
  );
  cost.bytes += storedBytes(listed);
  const streams = Arr.filter(listed, (stream) => stream.order === turn.order);
  const placed = yield* placeRows(turn, keys, rows);
  if (Arr.isReadonlyArrayNonEmpty(stored)) {
    // The component reads each row to delete it and writes it away, so a delete counts twice.
    cost.bytes += 2 * storedBytes(stored);
    yield* Effect.promise(() =>
      ctx.runMutation(components.nina.messages.deleteByIds, {
        messageIds: Arr.map(stored, (row) => row._id),
      })
    );
  }
  const written = yield* writeRuns(ctx, turn, placed);
  cost.bytes += storedBytes(written);
  const sameSteps =
    written.length === placed.length &&
    Arr.every(
      Arr.zip(written, placed),
      ([doc, { identity }]) => doc.stepOrder === identity.stepOrder
    );
  if (!sameSteps) {
    return yield* Effect.die(new TurnSealError());
  }
  yield* Effect.forEach(
    streams,
    (stream) =>
      Effect.promise(() =>
        ctx.runMutation(components.nina.streams.deleteStreamAsync, {
          streamId: stream.streamId,
        })
      ),
    { discard: true }
  );
  const sealed = {
    ...turn,
    sealedAt: yield* Clock.currentTimeMillis,
  };
  yield* writer.table("ninaTurns").replace(turn._id, sealed).pipe(Effect.orDie);
  cost.bytes += storedBytes(sealed);
  return cost.bytes;
});
