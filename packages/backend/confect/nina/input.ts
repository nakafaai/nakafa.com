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
import { NinaGenerationError } from "@repo/backend/confect/nina/failure";
import { assembleContext } from "@repo/backend/confect/nina/history";
import { withTurnContext } from "@repo/backend/confect/nina/prompt/user";
import type { NinaUncoveredTurn } from "@repo/backend/confect/nina/summaries.spec";
import { Array as Arr, Effect, HashSet, Option, Order, pipe } from "effect";

/** Messages one query reads from the thread. */
const PAGE = 50;
/**
 * Queries one generation makes. Four pages hold the four newest turns the
 * summary always leaves verbatim, even at the 20 steps a turn may take.
 */
const PAGES = 4;

const unreadable = () => new NinaGenerationError({ reason: "unknown" });

/**
 * The orders of the turns the model may see: the complete turns the summary
 * does not cover, except one that a later complete turn answered again, or
 * that the current turn answers again.
 */
function visibleOrders(
  turns: readonly (typeof NinaUncoveredTurn.Type)[],
  retrying: number | undefined
) {
  const replaced = HashSet.fromIterable([
    ...Arr.flatMap(turns, ({ retryOf }) =>
      retryOf === undefined ? [] : [retryOf]
    ),
    ...(retrying === undefined ? [] : [retrying]),
  ]);
  return Arr.filter(
    Arr.map(turns, ({ order }) => order),
    (order) => !HashSet.has(replaced, order)
  );
}

/** Reads the newest messages of the thread up to the turn, until one is older than `oldest`. */
const readDocs = Effect.fn("nina.input.docs")(function* (
  turn: Pick<NinaTurnsDoc, "promptMessageId" | "threadId">,
  oldest: number
) {
  const ctx = yield* ActionCtx;
  let docs: MessageDoc[] = [];
  let cursor: string | null = null;
  for (let read = 0; read < PAGES; read += 1) {
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
      catch: unreadable,
    });
    docs = Arr.appendAll(docs, page.page);
    if (page.isDone || Arr.some(page.page, (doc) => doc.order < oldest)) {
      break;
    }
    cursor = page.continueCursor;
  }
  return docs;
});

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

/**
 * Reads the model input of one turn by turn order, not as the last messages of
 * the thread. The history is the complete turns after the summary, each whole
 * with its question and answer: a cancelled or failed turn leaves no messages
 * behind, and a turn the learner asked again shows only its newest asking. The
 * learner's message carries the turn's runtime facts, which are not stored.
 */
export const readInput = Effect.fn("nina.input.read")(function* (
  turn: Pick<
    NinaTurnsDoc,
    "chatId" | "order" | "promptMessageId" | "retryOf" | "threadId"
  >,
  {
    context,
    through,
  }: { readonly context: string; readonly through: number | null }
) {
  const uncovered = yield* (yield* QueryRunner)
    .runQuery(refs.internal.nina.summaries.uncovered, {
      before: turn.order,
      chatId: turn.chatId,
      through,
    })
    .pipe(Effect.mapError(unreadable));
  const orders = Arr.sort(visibleOrders(uncovered, turn.retryOf), Order.Number);
  const docs = yield* readDocs(
    turn,
    Option.getOrElse(Arr.head(orders), () => turn.order)
  );
  const history = Arr.flatMap(orders, (order) => {
    const stored = storedTurn(docs, order);
    return isComplete(stored) ? [toMessages(stored)] : [];
  });
  const [question, ...answers] = toMessages(storedTurn(docs, turn.order));
  if (question?.role !== "user") {
    return yield* unreadable();
  }
  return assembleContext({
    current: [withTurnContext(question, context), ...answers],
    history,
  });
});
