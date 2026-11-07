import { saveMessages } from "@convex-dev/agent";
import { components } from "@repo/backend/confect/_generated/components";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Array as Arr, Schema } from "effect";

/**
 * Text that costs `tokens` model tokens by the shared estimator, one letter per
 * token (a single Latin letter costs one token, and a single space none), so a
 * test sizes a turn by what the budgets count.
 */
export function filler(tokens: number) {
  return Arr.join(
    Arr.makeBy(tokens, () => "a"),
    " "
  );
}

/**
 * The messages of one earlier turn: a question, tool steps, and an answer
 * that is followed by `padding` when a test needs a turn of a size.
 * A cancelled turn has one tool step and no answer.
 */
function earlierMessages(
  order: number,
  {
    cancelled,
    padding,
    question,
    steps,
  }: { cancelled: boolean; padding: string; question: string; steps: number }
) {
  const kind = cancelled ? "Cancelled" : "Earlier";
  const exchange = (step: number) => [
    {
      role: "assistant" as const,
      content: [
        {
          type: "tool-call" as const,
          toolCallId: `${kind}-call-${order}-${step}`,
          toolName: "nakafa",
          input: {},
        },
      ],
    },
    {
      role: "tool" as const,
      content: [
        {
          type: "tool-result" as const,
          toolCallId: `${kind}-call-${order}-${step}`,
          toolName: "nakafa",
          output: {
            type: "text" as const,
            value: `${kind} evidence ${order}.${step}`,
          },
        },
      ],
    },
  ];
  // makeBy always makes at least one step.
  const count = cancelled ? 1 : steps;
  return [
    { role: "user" as const, content: question },
    ...(count === 0
      ? []
      : Arr.flatMap(
          Arr.makeBy(count, (step) => step),
          exchange
        )),
    ...(cancelled
      ? []
      : [
          {
            role: "assistant" as const,
            content: `Earlier answer ${order}${padding}`,
          },
        ]),
  ];
}

/**
 * Saves one earlier turn of a chat at `order`, with its settled turn row. A
 * complete turn holds its question, `steps` tool steps and its answer. A
 * cancelled turn left a tool step behind, saved before the cancellation, and
 * its prompt is failed, as settlement leaves it. A retry asks again the
 * question of the turn that first asked it, which `retryOf` names.
 */
export async function seedEarlierTurn(
  ctx: MutationCtx,
  {
    cancelled = false,
    chatId,
    now,
    order,
    retryOf,
    steps = 0,
    threadId,
    tokens = 0,
    userId,
  }: {
    cancelled?: boolean;
    chatId: Docs["chats"]["_id"];
    now: number;
    order: number;
    retryOf?: number;
    steps?: number;
    threadId: string;
    tokens?: number;
    userId: Docs["users"]["_id"];
  }
) {
  const saved = await saveMessages(ctx, components.nina, {
    threadId,
    order,
    messages: earlierMessages(order, {
      cancelled,
      padding: tokens === 0 ? "" : ` ${filler(tokens)}`,
      question: cancelled
        ? `Cancelled question ${order}`
        : `Earlier question ${retryOf ?? order}`,
      steps,
    }),
  });
  const [prompt] = saved.messages;
  if (!prompt) {
    return Promise.reject(new Error("Fixture prompt missing"));
  }
  if (cancelled) {
    await ctx.runMutation(components.nina.messages.updateMessage, {
      messageId: prompt._id,
      patch: { status: "failed", error: "cancelled" },
    });
  }
  await ctx.db.insert("ninaTurns", {
    phase: "settled",
    chatId,
    order,
    promptMessageId: prompt._id,
    state: cancelled
      ? { status: "cancelled", finishedAt: now }
      : { status: "complete", finishedAt: now },
    threadId,
    usage: [],
    userId,
    ...(retryOf === undefined ? {} : { retryOf }),
  });
}

/** What a test says about one earlier turn: it was cancelled, asks again the question that the turn `retryOf` first asked, took `steps` tool steps, or has an answer of `tokens` more tokens. */
export const EarlierTurn = Schema.Struct({
  cancelled: Schema.optionalKey(Schema.Boolean),
  replies: Schema.optionalKey(Schema.Int),
  retryOf: Schema.optionalKey(Schema.Int),
  steps: Schema.optionalKey(Schema.Int),
  tokens: Schema.optionalKey(Schema.Int),
});

/** `count` complete turns. makeBy always makes at least one, so none is its own case. */
export function plainTurns(count: number) {
  return count === 0 ? [] : Arr.makeBy(count, () => ({}));
}
