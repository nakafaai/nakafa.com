import { saveMessages } from "@convex-dev/agent";
import {
  type MessageDoc,
  vMessageWithMetadata,
} from "@convex-dev/agent/validators";
import { components } from "@repo/backend/confect/_generated/components";
import type { NinaTurnsDoc } from "@repo/backend/confect/_generated/docs";
import type { MutationCtx } from "@repo/backend/confect/_generated/services";
import {
  identityOf,
  openMessage,
  sealMessage,
} from "@repo/backend/confect/nina/sealed";
import { storedBytes } from "@repo/backend/confect/nina/sealed/bytes";
import type { LearnerKeys } from "@repo/backend/confect/vault/keys";
import { parse } from "convex-helpers/validators";
import { Array as Arr, Effect, Order, Schema, Struct } from "effect";

/** A settled turn, as the seal reads it. */
export type SettledTurn = Extract<NinaTurnsDoc, { phase: "settled" }>;

/**
 * The seal could not write the sealed rows at the steps it named. The whole seal
 * is one transaction, so nothing of the turn is written when this is raised.
 */
export class TurnSealError extends Schema.TaggedError<TurnSealError>()(
  "TurnSealError",
  {}
) {}

/**
 * Rows one query reads of a turn. The seal reads pages until it reaches the prompt, so
 * the page size sets how many queries it takes, and never which rows it seals.
 */
const TURN_PAGE = 10;

/**
 * The status a row keeps when the seal writes it. A pending row reaches the seal only
 * once its run has ended, so the step is written as failed, the status the Agent gives
 * the rows of a failed step.
 */
function sealedStatus(status: MessageDoc["status"]): MessageDoc["status"] {
  return status === "pending" ? "failed" : status;
}

/** A row of a turn, sealed for the step it takes, with the agent that wrote it. */
type PlacedRow = Effect.Success<ReturnType<typeof placeRows>>[number];

/**
 * Reads the rows that a turn wrote above its prompt. The thread is read newest first
 * from the prompt, `TURN_PAGE` rows at a time. The read stops at the prompt, which is
 * the lowest row of the turn, so no row of an older turn is kept. Every page the read
 * takes counts its rows once. Returns the rows opened for the learner, and the rows as
 * the component stores them, which the seal deletes.
 */
export const readTurnRows = Effect.fn("nina.sealed.turn.rows")(function* (
  ctx: MutationCtx,
  turn: SettledTurn,
  keys: LearnerKeys,
  cost: { bytes: number }
) {
  let stored: readonly MessageDoc[] = [];
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
    cost.bytes += storedBytes(page.page);
    stored = Arr.appendAll(
      stored,
      Arr.filter(
        page.page,
        (row) => row.order === turn.order && row._id !== turn.promptMessageId
      )
    );
    reached =
      page.isDone ||
      Arr.some(page.page, (row) => row._id === turn.promptMessageId);
    cursor = page.continueCursor;
  }
  const rows = yield* Effect.forEach(stored, (row) =>
    openMessage(keys, identityOf(row), row)
  ).pipe(Effect.orDie);
  return { rows, stored };
});

/** Seals each row of a turn for the step it takes once written, with its agent (ADR 0024). */
export const placeRows = Effect.fn("nina.sealed.turn.place")(function* (
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
    const stored = { ...row, status: sealedStatus(row.status) };
    return sealMessage(
      keys,
      identity,
      parse(vMessageWithMetadata, stored)
    ).pipe(
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
export const writeRuns = Effect.fn("nina.sealed.turn.write")(function* (
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
