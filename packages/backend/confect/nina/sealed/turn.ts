import { abortStream, listStreams, saveMessages } from "@convex-dev/agent";
import {
  type MessageDoc,
  vMessageWithMetadata,
} from "@convex-dev/agent/validators";
import { components } from "@repo/backend/confect/_generated/components";
import type { Docs, NinaTurnsDoc } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import {
  identityOf,
  openMessage,
  sealMessage,
} from "@repo/backend/confect/nina/sealed";
import { ensureLearnerKeys } from "@repo/backend/confect/vault/keys";
import { parse } from "convex-helpers/validators";
import { Array as Arr, Clock, Effect, Order, Schema, Struct } from "effect";

/** A settled turn, as the seal reads it. */
type SettledTurn = Extract<NinaTurnsDoc, { phase: "settled" }>;
type LearnerKeys = Effect.Success<ReturnType<typeof ensureLearnerKeys>>;

/**
 * The seal could not write the sealed rows at the steps it named. The whole seal
 * is one transaction, so nothing of the turn is written when this is raised.
 */
class TurnSealError extends Schema.TaggedError<TurnSealError>()(
  "TurnSealError",
  {}
) {}

/**
 * Rows one query reads of a turn. The seal reads pages until it reaches the prompt, so
 * the page size sets how many queries it takes, and never which rows it seals.
 */
const TURN_PAGE = 10;

/** A row of a turn, sealed for the step it takes, with the agent that wrote it. */
type PlacedRow = Effect.Success<ReturnType<typeof placeRows>>[number];

/**
 * Reads the rows that a turn wrote above its prompt, opened for its learner. The
 * thread is read newest first from the prompt, `TURN_PAGE` rows at a time. The read
 * stops at the prompt, which is the lowest row of the turn, so no row of an older
 * turn is kept.
 */
const readTurnRows = Effect.fn("nina.sealed.turn.rows")(function* (
  ctx: MutationCtx,
  turn: SettledTurn,
  keys: LearnerKeys
) {
  let rows: readonly MessageDoc[] = [];
  let cursor: string | null = null;
  let reached = false;
  while (!reached) {
    const page = yield* Effect.promise(() =>
      ctx.runQuery(components.nina.messages.listMessagesByThreadId, {
        order: "desc",
        paginationOpts: { cursor, numItems: TURN_PAGE },
        threadId: turn.threadId,
        upToAndIncludingMessageId: turn.promptMessageId,
      })
    );
    const own = Arr.filter(
      page.page,
      (row) => row.order === turn.order && row._id !== turn.promptMessageId
    );
    const opened = yield* Effect.forEach(own, (row) =>
      openMessage(keys, identityOf(row), row)
    ).pipe(Effect.orDie);
    rows = Arr.appendAll(rows, opened);
    reached =
      page.isDone ||
      Arr.some(page.page, (row) => row._id === turn.promptMessageId);
    cursor = page.continueCursor;
  }
  return rows;
});

/**
 * Seals each row of a turn for the step it takes once written. The component numbers
 * the rows of one write from the step after the prompt, so the rows take 1, 2, 3, and
 * so on in the order they had. Sealed content opens only for that place (ADR 0024).
 */
const placeRows = Effect.fn("nina.sealed.turn.place")(function* (
  turn: SettledTurn,
  keys: LearnerKeys,
  rows: readonly MessageDoc[]
) {
  const ordered = Arr.sortWith(rows, (row) => row.stepOrder, Order.Number);
  return yield* Effect.forEach(ordered, (row, index) => {
    const identity = {
      order: turn.order,
      stepOrder: index + 1,
      threadId: turn.threadId,
    };
    return sealMessage(keys, identity, parse(vMessageWithMetadata, row)).pipe(
      Effect.map((sealed) => ({
        agentName: row.agentName,
        identity,
        sealed,
      })),
      Effect.orDie
    );
  });
});

/**
 * Writes the sealed rows in the order they were placed, as one write for each run
 * of rows that share an agent name, because the component stores one agent name per
 * write. The runs are written one after another, so each takes the steps after the
 * rows before it. Returns the rows as the component stored them.
 */
const writeRuns = Effect.fn("nina.sealed.turn.write")(function* (
  ctx: MutationCtx,
  turn: SettledTurn,
  placed: readonly PlacedRow[]
) {
  if (!Arr.isReadonlyArrayNonEmpty(placed)) {
    return [];
  }
  const runs = Arr.groupWith(
    placed,
    (self, that) => self.agentName === that.agentName
  );
  const written = yield* Effect.forEach(runs, (run) => {
    const agentName = Arr.headNonEmpty(run).agentName;
    return Effect.promise(() =>
      saveMessages(ctx, components.nina, {
        ...(agentName === undefined ? {} : { agentName }),
        messages: Arr.map(run, ({ sealed }) => sealed.message),
        metadata: Arr.map(run, ({ sealed }) =>
          Struct.omit(sealed, ["message"])
        ),
        order: turn.order,
        threadId: turn.threadId,
      })
    );
  });
  return Arr.flatMap(written, (result) => result.messages);
});

/**
 * Seals the rows of one settled turn and deletes the deltas of its streams (ADR
 * 0024). Its assistant and tool rows are deleted and written again sealed, at the
 * steps they take now, with the same order, and the turn records `sealedAt` in the
 * same transaction. The deltas go page by page. A turn that is not settled, that
 * already carries `sealedAt`, whose chat is gone, or whose learner's account is
 * deleted is left alone, so a retry or a late sweep does no harm. The prompt is not
 * written again, because the admission sealed it (`sealed/save.ts`).
 */
export const sealTurn = Effect.fn("nina.sealed.turn")(function* (
  turnId: Docs["ninaTurns"]["_id"]
) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const ctx = yield* MutationCtx;
  const turn = yield* reader
    .table("ninaTurns")
    .get(turnId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  if (turn?.phase !== "settled" || turn.sealedAt !== undefined) {
    return null;
  }
  const chat = yield* reader
    .table("chats")
    .get(turn.chatId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  const user = yield* reader
    .table("users")
    .get(turn.userId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  if (!(chat && user) || user.deletedAt !== undefined) {
    return null;
  }
  const keys = yield* ensureLearnerKeys(turn.userId).pipe(Effect.orDie);
  // The prompt keeps its order in the clear, so the seal checks its place and does not
  // open its content. Opening it would read the learner's key a second time.
  const [prompt] = yield* Effect.promise(() =>
    ctx.runQuery(components.nina.messages.getMessagesByIds, {
      messageIds: [turn.promptMessageId],
    })
  );
  if (prompt?.order !== turn.order) {
    return null;
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
  const streams = Arr.filter(
    yield* Effect.promise(() =>
      listStreams(ctx, components.nina, {
        includeStatuses: ["streaming", "finished", "aborted"],
        startOrder: turn.order,
        threadId: turn.threadId,
      })
    ),
    (stream) => stream.order === turn.order
  );
  const rows = yield* readTurnRows(ctx, turn, keys);
  const placed = yield* placeRows(turn, keys, rows);
  if (Arr.isReadonlyArrayNonEmpty(rows)) {
    yield* Effect.promise(() =>
      ctx.runMutation(components.nina.messages.deleteByIds, {
        messageIds: Arr.map(rows, (row) => row._id),
      })
    );
  }
  const written = yield* writeRuns(ctx, turn, placed);
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
  yield* writer
    .table("ninaTurns")
    .replace(turn._id, {
      ...turn,
      sealedAt: yield* Clock.currentTimeMillis,
    })
    .pipe(Effect.orDie);
  return null;
});
