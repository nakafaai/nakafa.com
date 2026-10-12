import { Agent, type UsageHandler } from "@convex-dev/agent";
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
import type { UsageAgent } from "@repo/backend/confect/nina/contract/usage";
import { NinaFailureOperation } from "@repo/backend/confect/nina/failure";
import { newestAskings, questionKey } from "@repo/backend/confect/nina/history";
import { SUMMARY_FOLD_LIMIT } from "@repo/backend/confect/nina/summaries.spec";
import { Array as Arr, Effect, HashSet, Schema } from "effect";

/** Complete turns kept verbatim after the summary. */
export const RECENT_TURNS = 4;
/** Turns that must wait beyond the verbatim window before a refresh runs. */
const FOLD_TURNS = 4;
/** Text one message contributes to a refresh transcript. */
const MESSAGE_TOKENS = 1500;
const MESSAGE_PAGE = 100;

const INSTRUCTIONS = Arr.join(
  [
    "You maintain the running summary of a tutoring conversation between a learner and Nina, Nakafa's AI tutor.",
    "Rewrite the previous summary so it also covers the new turns.",
    "Keep the learner's goals, level, and preferences; every question with the method and final answers Nina gave; open problems; and anything Nina promised to follow up.",
    "Drop greetings, filler, and tool or system mechanics. Never invent facts.",
    "Write compact bullet points in the conversation's language, at most 250 words.",
  ],
  "\n"
);

class NinaSummaryError extends Schema.TaggedError<NinaSummaryError>()(
  "NinaSummaryError",
  { operation: NinaFailureOperation }
) {}

/**
 * Returns the order a refresh should summarize through once `order` settles.
 * A refresh waits until enough turns sit between the summary and the verbatim
 * window, so one fast-model call folds several turns, and never folds more
 * than one bounded batch. A chat with a longer backlog, such as one that
 * predates summaries, advances one bounded batch per completed turn.
 */
export function nextSummaryTarget(order: number, throughOrder: number | null) {
  const covered = throughOrder ?? -1;
  const target = Math.min(order - RECENT_TURNS, covered + SUMMARY_FOLD_LIMIT);
  return target - covered >= FOLD_TURNS ? target : null;
}

/**
 * Lists the orders of the turns a fold covers: the complete turns after
 * `covered` through `target`, except one whose question a later complete turn
 * asks again, up to the turn that just settled. The summary then holds the same
 * turns the verbatim history would show: a cancelled or failed turn, or an
 * answer that a retry replaced, never reaches it. A fold spans at most
 * `SUMMARY_FOLD_LIMIT` turns. The later askings are found by their question,
 * not by scanning the turns after the fold, so a retry far ahead of a long
 * backlog counts like one next to it.
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
  return HashSet.fromIterable(
    Arr.map(newestAskings(folded, again), ({ order }) => order)
  );
});

/**
 * Reads learner and Nina text for the turns at `orders`. Pages run newest
 * first from `anchor`, the prompt of the last turn the fold covers, and stop
 * at turns the summary already covers, so a refresh reads only its batch.
 */
const readTranscript = Effect.fn("nina.summary.transcript")(function* (
  threadId: string,
  from: number,
  orders: HashSet.HashSet<number>,
  anchor: string
) {
  const ctx = yield* ActionCtx;
  let lines: string[] = [];
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
    for (const message of page.page) {
      if (HashSet.has(orders, message.order) && message.text) {
        const speaker = message.message?.role === "user" ? "Learner" : "Nina";
        lines = Arr.append(
          lines,
          `${speaker}: ${boundText(message.text, MESSAGE_TOKENS, "Message shortened.")}`
        );
      }
    }
    done =
      page.isDone || Arr.some(page.page, (message) => message.order <= from);
    cursor = page.continueCursor;
  }
  return Arr.join(Arr.reverse(lines), "\n\n");
});

/**
 * Folds settled turns into the chat's rolling summary once a fold is due. A
 * failure keeps the previous summary; generation still bounds its history. The
 * model call records its usage in the ledger of the turn that settled, as the
 * title and the follow-up suggestions do.
 */
export const refreshSummary = Effect.fn("nina.summary.refresh")(
  function* (
    turn: Pick<NinaTurnsDoc, "chatId" | "order" | "threadId" | "userId">,
    usageHandler: UsageHandler
  ) {
    const { runQuery: query } = yield* QueryRunner;
    const current = yield* query(refs.internal.nina.summaries.read, {
      chatId: turn.chatId,
    }).pipe(Effect.orDie);
    const covered = current?.throughOrder ?? null;
    const target = nextSummaryTarget(turn.order, covered);
    if (target === null) {
      return;
    }
    const anchor = yield* query(refs.internal.nina.summaries.anchor, {
      chatId: turn.chatId,
      order: target,
    }).pipe(Effect.orDie);
    if (!anchor) {
      return yield* new NinaSummaryError({ operation: "read" });
    }
    const orders = yield* readOrders(turn, covered, target);
    const transcript = yield* readTranscript(
      turn.threadId,
      covered ?? -1,
      orders,
      anchor
    );
    const ctx = yield* ActionCtx;
    const handle = (yield* Gateway).language("background");
    const agent = new Agent(components.nina, {
      instructions: INSTRUCTIONS,
      languageModel: handle.model,
      name: "summary" satisfies UsageAgent,
      usageHandler,
    });
    const { text } = yield* Effect.tryPromise({
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
    if (!summary) {
      return yield* new NinaSummaryError({ operation: "generate" });
    }
    yield* (yield* MutationRunner)
      .runMutation(refs.internal.nina.summaries.save, {
        chatId: turn.chatId,
        text: boundText(summary, NINA_BUDGET.summary, "Summary shortened."),
        throughOrder: target,
      })
      .pipe(Effect.orDie);
  },
  Effect.catchTag("NinaSummaryError", (error) =>
    Effect.logWarning("Nina summary unavailable", {
      operation: error.operation,
    })
  )
);
