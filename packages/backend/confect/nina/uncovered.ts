import {
  docsToModelMessages,
  filterOutOrphanedToolMessages,
  type MessageDoc,
} from "@convex-dev/agent";
import { components } from "@repo/backend/confect/_generated/components";
import type { NinaTurnsDoc } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  ActionCtx,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import { NINA_BUDGET } from "@repo/backend/confect/nina/budget";
import {
  type Asking,
  newestAskings,
  sentTurn,
} from "@repo/backend/confect/nina/history";
import { SUMMARY_FOLD_LIMIT } from "@repo/backend/confect/nina/summaries.spec";
import {
  Array as Arr,
  Effect,
  Option,
  Order,
  pipe,
  Result,
  Schema,
} from "effect";

/** Messages one query reads from the thread. */
const PAGE = 50;

/** The turn records or the thread could not be read. */
class NinaUncoveredError extends Schema.TaggedError<NinaUncoveredError>()(
  "NinaUncoveredError",
  {}
) {}

/** The stored messages of one turn, in the order the model produced them. */
function storedTurn(docs: readonly MessageDoc[], order: number) {
  return pipe(
    docs,
    Arr.filter((doc) => doc.order === order),
    Arr.sortWith((doc) => doc.stepOrder, Order.Number)
  );
}

/** Whether a stored turn opens with its question and holds an answer to it. */
function isComplete(stored: readonly MessageDoc[]) {
  return (
    Option.exists(Arr.head(stored), (doc) => doc.message?.role === "user") &&
    Arr.some(stored, (doc) => doc.message?.role === "assistant")
  );
}

/** Model messages of one stored turn, without a tool call or result that lost its partner. */
function toMessages(stored: MessageDoc[]) {
  return docsToModelMessages(filterOutOrphanedToolMessages(stored));
}

/** The model messages of the turn at `order`, from messages a read returned. */
export function turnMessages(docs: readonly MessageDoc[], order: number) {
  return toMessages(storedTurn(docs, order));
}

/** One earlier turn as the model receives it, with the order it was asked at. */
function costed(order: number, stored: MessageDoc[]) {
  return { order, ...sentTurn(toMessages(stored)) };
}

/**
 * Whether the turns together cost more than the history budget. A fold needs a
 * turn to take and the newest to keep, so a lone turn never counts: the read
 * goes on to find an older one.
 */
function outweighs(turns: readonly ReturnType<typeof costed>[]) {
  return (
    turns.length > 1 &&
    Arr.reduce(turns, 0, (total, { tokens }) => total + tokens) >
      NINA_BUDGET.history
  );
}

/**
 * Reads the complete turns after the summary, oldest first, each with the
 * messages the model would receive and what they cost. The turns lie below the
 * order `before`, which is the turn being answered, or one past the turn that
 * just settled, and above the order `through` that the summary covers. `later`
 * holds the turns after them, such as the one being answered, whose question
 * hides the earlier askings of the same question.
 *
 * Turns are read newest first, `SUMMARY_FOLD_LIMIT` at a time with the thread
 * messages they need, and the read stops after the page that brings them past
 * the history budget. It is bounded by the budget, not by the length of the
 * chat: older turns cannot fit beside the ones read, and a fold takes them
 * first. `docs` returns every message read, so a caller finds the turn at
 * `before` in them too.
 */
export const readUncovered = Effect.fn("nina.uncovered.read")(function* (
  turn: Pick<NinaTurnsDoc, "chatId" | "promptMessageId" | "threadId">,
  before: number,
  through: number | null,
  later: readonly Asking[]
) {
  const ctx = yield* ActionCtx;
  const { runQuery: query } = yield* QueryRunner;
  let docs: MessageDoc[] = [];
  let cursor: string | null = null;
  let done = false;
  // Reads pages of the thread, newest first, until one reaches a message
  // older than `oldest`, so every message of the turn at `oldest` is read.
  const readDown = Effect.fn("nina.uncovered.docs")(function* (oldest: number) {
    while (!(done || Arr.some(docs, (doc) => doc.order < oldest))) {
      const page = yield* Effect.tryPromise({
        try: () =>
          ctx.runQuery(components.nina.messages.listMessagesByThreadId, {
            excludeToolMessages: false,
            order: "desc",
            paginationOpts: { cursor, numItems: PAGE },
            statuses: ["success"],
            threadId: turn.threadId,
            upToAndIncludingMessageId: turn.promptMessageId,
          }),
        catch: () => new NinaUncoveredError(),
      });
      docs = Arr.appendAll(docs, page.page);
      done = page.isDone;
      cursor = page.continueCursor;
    }
  });
  yield* readDown(before);
  let newer = later;
  let found: ReturnType<typeof costed>[] = [];
  let upTo = before;
  let exhausted = false;
  while (!(exhausted || outweighs(found))) {
    const rows = yield* query(refs.internal.nina.summaries.uncovered, {
      before: upTo,
      chatId: turn.chatId,
      through,
    }).pipe(Effect.mapError(() => new NinaUncoveredError()));
    exhausted = rows.length < SUMMARY_FOLD_LIMIT;
    if (Arr.isReadonlyArrayNonEmpty(rows)) {
      const oldest = Arr.lastNonEmpty(rows).order;
      yield* readDown(oldest);
      found = Arr.appendAll(
        found,
        Arr.filterMap(newestAskings(rows, newer), ({ order }) => {
          const stored = storedTurn(docs, order);
          return isComplete(stored)
            ? Result.succeed(costed(order, stored))
            : Result.failVoid;
        })
      );
      newer = Arr.appendAll(newer, rows);
      upTo = oldest;
    }
  }
  return { docs, turns: Arr.reverse(found) };
});
