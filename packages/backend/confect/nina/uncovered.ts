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
import { foldCanWait, HISTORY_TURNS } from "@repo/backend/confect/nina/fold";
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

/**
 * Messages one query reads when it reads one turn only. A turn holds its prompt,
 * an answer for each step and a result for each step that called tools, so ten
 * rows hold the prompt, three steps that called tools and the answer, and one
 * row of the turn before that ends the read. A longer turn takes another query,
 * and the step limit of a run (`isStepCount` in `generation.ts`) bounds how
 * many. A page of `PAGE` would read more rows of the turns before it, which
 * this read does not need.
 */
const OWN_PAGE = 10;

/**
 * Rows the read may pass without keeping a turn from them, which is two pages
 * of turns. A row it keeps nothing of is an asking that a retry replaced, or a
 * turn that lost its question. The model never receives one, so it never brings
 * the turns past the history budget, and a learner who retries one question
 * again and again would make every read go through the whole chat.
 */
const PASSED_LIMIT = 2 * SUMMARY_FOLD_LIMIT;

/** The turn records or the thread could not be read. */
class NinaUncoveredError extends Schema.TaggedError<NinaUncoveredError>()(
  "NinaUncoveredError",
  {}
) {}

/** The stored messages of one turn, in the order the model produced them. */
export function storedTurn(docs: readonly MessageDoc[], order: number) {
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
 * Reads the messages of a thread in pages of `size`, newest first, from the
 * prompt of `turn` down. `down(oldest)` reads pages until one reaches a message
 * older than `oldest`, so every message of the turn at `oldest` is read, and
 * `docs` holds everything read so far.
 */
const threadReader = Effect.fn("nina.uncovered.thread")(function* (
  turn: Pick<NinaTurnsDoc, "promptMessageId" | "threadId">,
  size: number
) {
  const ctx = yield* ActionCtx;
  let docs: MessageDoc[] = [];
  let cursor: string | null = null;
  let done = false;
  return {
    docs: () => docs,
    down: Effect.fn("nina.uncovered.docs")(function* (oldest: number) {
      while (!(done || Arr.some(docs, (doc) => doc.order < oldest))) {
        const page = yield* Effect.tryPromise({
          try: () =>
            ctx.runQuery(components.nina.messages.listMessagesByThreadId, {
              excludeToolMessages: false,
              order: "desc",
              paginationOpts: { cursor, numItems: size },
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
    }),
  };
});

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
 * the history budget: older turns cannot fit beside the ones read, and a fold
 * takes them first. It also stops once it holds `HISTORY_TURNS` turns, however
 * little they cost, and takes only the newest turns of the page that reaches
 * that count, so it never returns more. And it stops once it has passed
 * `PASSED_LIMIT` rows without keeping a turn. So neither a chat of very short
 * turns nor one full of replaced askings can make it read the whole chat. The
 * read is bounded by the budget and by those two counts, not by the length of
 * the chat.
 *
 * `unread` names the highest order the read did not list, when it stopped
 * before the oldest turn the summary does not cover. The turns up to it are in
 * neither the history nor the summary until a fold covers them. `docs` returns
 * every message read: all those of the turns listed, and of the turn at
 * `before`, so a caller finds that turn in them too.
 *
 * `first` holds the first page of turns, those below `before` and above
 * `through`, when the caller has read them already, so the read does not ask
 * for them again.
 */
export const readUncovered = Effect.fn("nina.uncovered.read")(function* (
  turn: Pick<NinaTurnsDoc, "chatId" | "promptMessageId" | "threadId">,
  before: number,
  through: number | null,
  later: readonly Asking[],
  first?: readonly Asking[]
) {
  const { runQuery: query } = yield* QueryRunner;
  const thread = yield* threadReader(turn, PAGE);
  yield* thread.down(before);
  let newer = later;
  let found: ReturnType<typeof costed>[] = [];
  let upTo = before;
  let exhausted = false;
  // Rows listed that kept no turn, which `PASSED_LIMIT` bounds.
  let passed = 0;
  // The page of turns the caller read, for the first round only.
  let known = first;
  while (
    !(
      exhausted ||
      outweighs(found) ||
      found.length >= HISTORY_TURNS ||
      passed >= PASSED_LIMIT
    )
  ) {
    const rows =
      known ??
      (yield* query(refs.internal.nina.summaries.uncovered, {
        before: upTo,
        chatId: turn.chatId,
        through,
      }).pipe(Effect.mapError(() => new NinaUncoveredError())));
    known = undefined;
    exhausted = rows.length < SUMMARY_FOLD_LIMIT;
    if (Arr.isReadonlyArrayNonEmpty(rows)) {
      const oldest = Arr.lastNonEmpty(rows).order;
      yield* thread.down(oldest);
      const kept = Arr.filterMap(newestAskings(rows, newer), ({ order }) => {
        const stored = storedTurn(thread.docs(), order);
        return isComplete(stored)
          ? Result.succeed(costed(order, stored))
          : Result.failVoid;
      });
      // The history takes `HISTORY_TURNS` turns and no more, so the page that
      // reaches that count gives only its newest turns, and the read ends at
      // the last one taken: the rest of the page is left for a fold.
      const taken = Arr.take(kept, HISTORY_TURNS - found.length);
      const cut = taken.length < kept.length;
      found = Arr.appendAll(found, taken);
      passed += rows.length - kept.length;
      newer = Arr.appendAll(newer, rows);
      exhausted = exhausted && !cut;
      upTo = cut
        ? Arr.reduce(taken, upTo, (lowest, { order }) =>
            Math.min(lowest, order)
          )
        : oldest;
    }
  }
  // The oldest turn the summary does not cover is the one after `through`.
  const listedAll = exhausted || upTo <= (through ?? -1) + 1;
  return {
    docs: thread.docs(),
    turns: Arr.reverse(found),
    unread: listedAll ? Option.none() : Option.some(upTo - 1),
  };
});

/**
 * Reads what the turn that settled costs as the model would receive it, from
 * its own messages alone: pages of `OWN_PAGE` from its prompt down, until one
 * reaches an older turn. A turn that does not open with its question or holds
 * no answer reads as none.
 */
const readOwnCost = Effect.fn("nina.uncovered.own")(function* (
  turn: Pick<NinaTurnsDoc, "order" | "promptMessageId" | "threadId">
) {
  const thread = yield* threadReader(turn, OWN_PAGE);
  yield* thread.down(turn.order);
  const stored = storedTurn(thread.docs(), turn.order);
  return isComplete(stored)
    ? Option.some(costed(turn.order, stored).tokens)
    : Option.none();
});

/**
 * Whether the fold can wait for the turn that settled without reading the
 * turns before it again. Its prompt stored what the history cost when it was
 * built (`NinaHistoryCost`), so only the turn itself is read: the history of
 * its prompt together with it still fits the budget, and the read left no turn
 * out (`foldCanWait`). A turn that stored no cost, a history that did not fit
 * or left a turn out, and a turn that holds no question and answer all leave
 * the decision to the read of the turns. A turn whose messages cannot be read
 * fails.
 */
export const foldWaits = Effect.fn("nina.uncovered.waits")(function* (
  turn: Pick<NinaTurnsDoc, "history" | "order" | "promptMessageId" | "threadId">
) {
  const cost = turn.history;
  if (!(cost && foldCanWait(cost, 0, NINA_BUDGET.history))) {
    return false;
  }
  const own = yield* readOwnCost(turn);
  return Option.exists(own, (tokens) =>
    foldCanWait(cost, tokens, NINA_BUDGET.history)
  );
});
