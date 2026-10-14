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
import { languageModel } from "@repo/backend/confect/gateway/model";
import { newestAskings, questionKey } from "@repo/backend/confect/nina/asking";
import {
  boundText,
  countTextTokens,
  NINA_BUDGET,
  NINA_CALL_LIMIT,
} from "@repo/backend/confect/nina/budget";
import { NinaFailureOperation } from "@repo/backend/confect/nina/failure";
import { foldWithin, nextSummaryTarget } from "@repo/backend/confect/nina/fold";
import {
  foldedTurns,
  transcriptOf,
} from "@repo/backend/confect/nina/transcript";
import { readUncovered } from "@repo/backend/confect/nina/uncovered";
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
 * What the summary writer is told. The summary it writes is held to
 * `NINA_BUDGET.summary` by `boundText`, and the turns it reads are held to
 * `FOLD_BUDGET`.
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

/**
 * The most tokens a fold's transcript may carry: what the call limit leaves after
 * the previous summary at its budget, the writer's instructions, the two headings
 * of its prompt, and the overhead of its two messages, the instructions and the
 * prompt. A fold covers only the turns that fit, and the next fold covers the rest.
 */
const FOLD_BUDGET =
  NINA_CALL_LIMIT -
  NINA_BUDGET.summary -
  countTextTokens(INSTRUCTIONS) -
  countTextTokens("# Previous Summary\n\n# New Turns\n\n") -
  2 * languageModel.tokens.message;

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
 * Reads the turns a fold covers through `target`, each with the text the writer
 * reads of it. When the read of the uncovered turns reached the oldest of them,
 * it already holds them and its messages, so nothing is read again. A longer
 * backlog leaves the oldest turns unread, so their text comes from the thread,
 * starting at the prompt of the last turn the fold covers.
 */
const readTranscript = Effect.fn("nina.summary.transcript")(function* (
  turn: Pick<NinaTurnsDoc, "chatId" | "order" | "threadId">,
  covered: number | null,
  target: number,
  uncovered: Effect.Success<ReturnType<typeof readUncovered>>
) {
  if (Option.isNone(uncovered.unread)) {
    return foldedTurns(
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
  return foldedTurns(
    yield* readWindow(turn.threadId, covered ?? -1, anchor),
    orders
  );
});

/**
 * Folds settled turns into the chat's rolling summary once the turns it does
 * not cover cost more than the history budget. A failure keeps the previous
 * summary; generation still bounds its history.
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
    const folded = yield* readTranscript(turn, covered, target, uncovered);
    // The writer reads at most `FOLD_BUDGET`, so a fold may stop before its
    // target, and the next fold covers the rest.
    const through = foldWithin(folded, FOLD_BUDGET, target);
    const transcript = transcriptOf(
      Arr.takeWhile(folded, ({ order }) => order <= through)
    );
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
        throughOrder: through,
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
