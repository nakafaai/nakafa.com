import { Agent } from "@convex-dev/agent";
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
import { readUncovered } from "@repo/backend/confect/nina/uncovered";
import { Array as Arr, Effect, HashSet, Option, Schema } from "effect";

/** Text one message contributes to a refresh transcript. */
const MESSAGE_TOKENS = 1500;
const MESSAGE_PAGE = 100;

/**
 * What the summary writer is told. By the shared tokenizer on the app's own
 * copy, 800 words are about 1,100 tokens in English and 1,400 in Indonesian and
 * German. That leaves room under `NINA_BUDGET.summary` for a writer that runs
 * long, and `boundText` stays the hard bound.
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
    const { turns } = yield* readUncovered(
      turn,
      turn.order + 1,
      covered,
      []
    ).pipe(Effect.mapError(() => new NinaSummaryError({ operation: "read" })));
    const next = nextSummaryTarget(covered, turns, NINA_BUDGET.history);
    if (Option.isNone(next)) {
      return;
    }
    const target = next.value;
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
      name: "summary",
    });
    const { text, usage } = yield* Effect.tryPromise({
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
        usage: {
          input: usage.inputTokens ?? 0,
          output: usage.outputTokens ?? 0,
        },
      })
      .pipe(Effect.orDie);
  },
  Effect.catchTag("NinaSummaryError", (error) =>
    Effect.logWarning("Nina summary unavailable", {
      operation: error.operation,
    })
  )
);
