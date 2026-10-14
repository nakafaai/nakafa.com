import { Agent, type MessageDoc } from "@convex-dev/agent";
import { components } from "@repo/backend/confect/_generated/components";
import type { NinaTurnsDoc } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  ActionCtx,
  MutationRunner,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import { Gateway } from "@repo/backend/confect/gateway/handle";
import { boundText, NINA_BUDGET } from "@repo/backend/confect/nina/budget";
import { NinaFailureOperation } from "@repo/backend/confect/nina/failure";
import { nextSummaryTarget } from "@repo/backend/confect/nina/fold";
import { newestAskings, questionKey } from "@repo/backend/confect/nina/history";
import {
  readUncovered,
  storedTurn,
} from "@repo/backend/confect/nina/uncovered";
import {
  Array as Arr,
  Effect,
  Option,
  Order,
  pipe,
  Result,
  Schema,
} from "effect";

const MESSAGE_PAGE = 100;

/**
 * What the summary writer is told. A summary longer than `NINA_BUDGET.summary`
 * is cut by `boundText`, never refused.
 */
const INSTRUCTIONS = Arr.join(
  [
    "You maintain the running summary of a tutoring conversation between a learner and Nina, Nakafa's AI tutor.",
    "Rewrite the previous summary so it also covers the new turns.",
    "Keep the learner's goals, level, and preferences; every question with the method and final answers Nina gave; open problems; and anything Nina promised to follow up.",
    "Drop greetings, filler, and tool or system mechanics. Never invent facts.",
    "Write compact bullet points in the conversation's language, at most 800 words.",
  ],
  "\n"
);

class NinaSummaryError extends Schema.TaggedError<NinaSummaryError>()(
  "NinaSummaryError",
  { operation: NinaFailureOperation }
) {}

/**
 * Lists the orders of the turns a fold covers, oldest first: the complete
 * turns after `covered` through `target`, except one whose question a later
 * complete turn asks again, up to the turn that just settled. The summary then
 * holds the same turns the verbatim history would show: a cancelled or failed
 * turn, or an answer that a retry replaced, never reaches it. A fold spans at
 * most `SUMMARY_FOLD_LIMIT` turns. The later askings are found by their
 * question, not by scanning the turns after the fold, so a retry far ahead of a
 * long backlog counts like one next to it.
 */
const readOrders = Effect.fn("nina.summary.orders")(function* (
  turn: Pick<NinaTurnsDoc, "chatId" | "order">,
  covered: number | null,
  target: number
) {
  const { runQuery: query } = yield* QueryRunner;
  const folded = yield* query(refs.internal.nina.summaries.uncovered, {
    before: target + 1,
    chatId: turn.chatId,
    through: covered,
  }).pipe(Effect.orDie);
  const again = yield* query(refs.internal.nina.summaries.asked, {
    before: turn.order + 1,
    chatId: turn.chatId,
    questions: Arr.dedupe(Arr.map(folded, questionKey)),
  }).pipe(Effect.orDie);
  return pipe(
    newestAskings(folded, again),
    Arr.map(({ order }) => order),
    Arr.sort(Order.Number)
  );
});

/**
 * Reads the thread messages around the turns a fold covers. Pages run newest
 * first from `anchor`, the prompt of the last turn the fold covers, and stop at
 * turns the summary already covers, so a refresh reads only its batch.
 */
const readWindow = Effect.fn("nina.summary.window")(function* (
  threadId: string,
  from: number,
  anchor: string
) {
  const ctx = yield* ActionCtx;
  let docs: MessageDoc[] = [];
  let cursor: string | null = null;
  let done = false;
  while (!done) {
    const page = yield* Effect.tryPromise({
      try: () =>
        ctx.runQuery(components.nina.messages.listMessagesByThreadId, {
          excludeToolMessages: true,
          order: "desc",
          paginationOpts: { cursor, numItems: MESSAGE_PAGE },
          statuses: ["success"],
          threadId,
          upToAndIncludingMessageId: anchor,
        }),
      catch: () => new NinaSummaryError({ operation: "read" }),
    });
    docs = Arr.appendAll(docs, page.page);
    done =
      page.isDone || Arr.some(page.page, (message) => message.order <= from);
    cursor = page.continueCursor;
  }
  return docs;
});

/**
 * The learner and Nina text of the turns at `orders`, oldest first, from the
 * messages of a read. A message that holds a tool call or a tool result is
 * left out, so Nina's words are her answers.
 */
function transcriptOf(docs: readonly MessageDoc[], orders: readonly number[]) {
  return pipe(
    orders,
    Arr.flatMap((order) => storedTurn(docs, order)),
    Arr.filterMap((doc) =>
      doc.tool || !doc.text
        ? Result.failVoid
        : Result.succeed(
            `${doc.message?.role === "user" ? "Learner" : "Nina"}: ${boundText(doc.text, NINA_BUDGET.foldMessage, "Message shortened.")}`
          )
    ),
    Arr.join("\n\n")
  );
}

/**
 * Reads the text of the turns a fold covers through `target`. When the read of
 * the uncovered turns reached the oldest of them, it already holds them and its
 * messages, so nothing is read again. A longer backlog leaves the oldest turns
 * unread, so their text comes from the thread, starting at the prompt of the
 * last turn the fold covers.
 */
const readTranscript = Effect.fn("nina.summary.transcript")(function* (
  turn: Pick<NinaTurnsDoc, "chatId" | "order" | "threadId">,
  covered: number | null,
  target: number,
  uncovered: Effect.Success<ReturnType<typeof readUncovered>>
) {
  if (Option.isNone(uncovered.unread)) {
    return transcriptOf(
      uncovered.docs,
      Arr.filterMap(uncovered.turns, ({ order }) =>
        order <= target ? Result.succeed(order) : Result.failVoid
      )
    );
  }
  const { runQuery: query } = yield* QueryRunner;
  const anchor = yield* query(refs.internal.nina.summaries.anchor, {
    chatId: turn.chatId,
    order: target,
  }).pipe(Effect.orDie);
  if (!anchor) {
    return yield* new NinaSummaryError({ operation: "read" });
  }
  const orders = yield* readOrders(turn, covered, target);
  return transcriptOf(
    yield* readWindow(turn.threadId, covered ?? -1, anchor),
    orders
  );
});

/**
 * Folds settled turns into the chat's rolling summary once the turns it does
 * not cover cost more than the history budget. Nothing is stored when a read or
 * the call fails, when the answer is empty, or when it is cut at the output cap.
 * In each case the previous summary and its coverage stay, so the next refresh
 * folds the same turns again. An empty or cut answer still counts its usage;
 * generation still bounds its history.
 */
export const refreshSummary = Effect.fn("nina.summary.refresh")(
  function* (
    turn: Pick<
      NinaTurnsDoc,
      "chatId" | "order" | "promptMessageId" | "threadId" | "userId"
    >
  ) {
    const { runQuery: query } = yield* QueryRunner;
    const current = yield* query(refs.internal.nina.summaries.read, {
      chatId: turn.chatId,
    }).pipe(Effect.orDie);
    const covered = current?.throughOrder ?? null;
    // The turn that just settled is the newest of the turns to count.
    const uncovered = yield* readUncovered(
      turn,
      turn.order + 1,
      covered,
      []
    ).pipe(Effect.mapError(() => new NinaSummaryError({ operation: "read" })));
    const next = nextSummaryTarget(
      covered,
      uncovered.turns,
      NINA_BUDGET.history,
      uncovered.unread
    );
    if (Option.isNone(next)) {
      return;
    }
    const target = next.value;
    const transcript = yield* readTranscript(turn, covered, target, uncovered);
    const ctx = yield* ActionCtx;
    const handle = (yield* Gateway).language("background");
    const agent = new Agent(components.nina, {
      instructions: INSTRUCTIONS,
      languageModel: handle.model,
      name: "summary",
    });
    const { finishReason, text, usage } = yield* Effect.tryPromise({
      try: (signal) =>
        agent.generateText(
          ctx,
          { userId: turn.userId },
          {
            abortSignal: signal,
            prompt: Arr.join(
              [
                `# Previous Summary\n\n${current?.text ?? "None yet."}`,
                `# New Turns\n\n${transcript}`,
              ],
              "\n\n"
            ),
            timeout: handle.timeout,
          },
          { storageOptions: { saveMessages: "none" } }
        ),
      catch: () => new NinaSummaryError({ operation: "generate" }),
    });
    const summary = text.trim();
    // An answer cut at the output cap lost its last points, and saving it would
    // drop them from every later summary too. Its text is not stored, but the
    // call spent its tokens, and they count on the summary all the same.
    const stored = summary !== "" && finishReason !== "length";
    yield* (yield* MutationRunner)
      .runMutation(refs.internal.nina.summaries.save, {
        chatId: turn.chatId,
        ...(stored
          ? {
              text: boundText(
                summary,
                NINA_BUDGET.summary,
                "Summary shortened."
              ),
            }
          : {}),
        throughOrder: target,
        usage: {
          input: usage.inputTokens ?? 0,
          output: usage.outputTokens ?? 0,
        },
      })
      .pipe(Effect.orDie);
    if (!stored) {
      return yield* new NinaSummaryError({ operation: "generate" });
    }
  },
  Effect.catchTag("NinaSummaryError", (error) =>
    Effect.logWarning("Nina summary unavailable", {
      operation: error.operation,
    })
  )
);
