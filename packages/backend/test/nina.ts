import { RegisteredConvexFunction } from "@confect/server";
import {
  createThread,
  listUIMessages,
  saveMessage,
  saveMessages,
} from "@convex-dev/agent";
import { components } from "@repo/backend/confect/_generated/components";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import schema from "@repo/backend/confect/_generated/schema";
import { openNinaLearningSession } from "@repo/backend/confect/nina/contract/pack";
import { reserveCredits } from "@repo/backend/confect/nina/credits/ledger";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { encodeJsonText } from "@repo/utilities/json";
import { MockLanguageModelV4 } from "ai/test";
import { Array as Arr, DateTime, Effect, Schema } from "effect";

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
async function seedEarlierTurn(
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
function plainTurns(count: number) {
  return count === 0 ? [] : Arr.makeBy(count, () => ({}));
}

/** Reserves a turn's credits, saves its prompt and queues the turn as the chat's active one. */
async function queueTurn(
  ctx: MutationCtx,
  {
    chatId,
    needsFetch = false,
    slug = "home",
    text,
    threadId,
    userId,
  }: {
    chatId: Docs["chats"]["_id"];
    needsFetch?: boolean;
    slug?: string;
    text: string;
    threadId: string;
    userId: Docs["users"]["_id"];
  }
) {
  const user = await ctx.db.get("users", userId);
  if (!user) {
    return Promise.reject(new Error("Fixture user missing"));
  }
  const reservation = await Effect.runPromise(
    reserveCredits(user).pipe(
      Effect.provide(RegisteredConvexFunction.mutationLayer(schema, ctx))
    )
  );
  const prompt = await saveMessage(ctx, components.nina, {
    threadId,
    prompt: text,
  });
  const session = await Effect.runPromise(
    openNinaLearningSession({
      learning: {
        locale: "en",
        slug,
        url: `https://nakafa.com/en/${slug}`,
        verified: false,
      },
    })
  );
  const turnId = await ctx.db.insert("ninaTurns", {
    ...reservation,
    phase: "active",
    threadId,
    chatId,
    requestId: `request-${prompt.message.order}`,
    fingerprint: `fingerprint-${prompt.message.order}`,
    promptMessageId: prompt.messageId,
    order: prompt.message.order,
    usage: [],
    user: {},
    page: {
      locale: "en",
      slug,
      needsFetch,
      nina: session.context,
    },
    state: { status: "queued" },
  });
  await ctx.db.patch("chats", chatId, { activeTurnId: turnId });
  return { turnId, promptMessageId: prompt.messageId };
}

/**
 * A real component thread with a reserved turn and its authenticated owner.
 * Earlier turns, each with its settled turn row, precede the reserved prompt:
 * `history` is a count of complete turns, or a list that names each one's kind.
 * `inspect` reads back what the turn left in storage: its user, turn, chat,
 * credit ledger, and messages.
 */
export async function createNinaTest({
  history = 0,
  now = DateTime.toEpochMillis(DateTime.nowUnsafe()),
  prompt: text = "Explain a limit.",
  needsFetch = false,
}: {
  history?: number | readonly (typeof EarlierTurn.Type)[];
  now?: number;
  prompt?: string;
  needsFetch?: boolean;
} = {}) {
  const t = createConvexTestWithBetterAuth();
  const identity = await t.mutation((ctx) =>
    seedAuthenticatedUser(ctx, { now, credits: 10 })
  );
  const saved = await t.mutation(async (ctx) => {
    const threadId = await createThread(ctx, components.nina, {
      userId: identity.userId,
    });
    const chatId = await ctx.db.insert("chats", {
      userId: identity.userId,
      threadId,
      type: "study",
      visibility: "private",
      updatedAt: now,
    });
    const earlier = typeof history === "number" ? plainTurns(history) : history;
    for (let order = 0; order < earlier.length; order += 1) {
      await seedEarlierTurn(ctx, {
        chatId,
        now,
        order,
        threadId,
        userId: identity.userId,
        ...earlier[order],
      });
    }
    const turn = await queueTurn(ctx, {
      chatId,
      needsFetch,
      text,
      threadId,
      userId: identity.userId,
    });
    return { ...turn, threadId, chatId };
  });
  const owner = t.withIdentity({
    subject: identity.authUserId,
    sessionId: identity.sessionId,
  });
  const inspect = () =>
    t.query(async (ctx) => ({
      user: await ctx.db.get("users", identity.userId),
      turn: await ctx.db.get("ninaTurns", saved.turnId),
      chat: await ctx.db.get("chats", saved.chatId),
      ledger: await ctx.db.query("creditTransactions").collect(),
      messages: await listUIMessages(ctx, components.nina, {
        threadId: saved.threadId,
        paginationOpts: { cursor: null, numItems: 20 },
      }),
    }));
  return { ...saved, t, owner, identity, inspect };
}

/**
 * Queues one more turn in the chat of a fixture, once the earlier one has
 * settled, on the page `slug`. It reserves five more of the learner's credits.
 */
export function appendNinaTurn(
  nina: Pick<
    Awaited<ReturnType<typeof createNinaTest>>,
    "chatId" | "identity" | "t" | "threadId"
  >,
  { prompt, slug }: { prompt: string; slug?: string }
) {
  return nina.t.mutation((ctx) =>
    queueTurn(ctx, {
      chatId: nina.chatId,
      text: prompt,
      threadId: nina.threadId,
      userId: nina.identity.userId,
      ...(slug === undefined ? {} : { slug }),
    })
  );
}

type ModelStream = Awaited<
  ReturnType<MockLanguageModelV4["doStream"]>
>["stream"];
type StreamPart = ModelStream extends ReadableStream<infer Part> ? Part : never;
export const ninaUsage = {
  inputTokens: { total: 12, noCache: 12, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 4, text: 3, reasoning: 1 },
};

export function ninaStream(parts: StreamPart[]) {
  return {
    stream: new ReadableStream<StreamPart>({
      start(controller) {
        for (const part of parts) {
          controller.enqueue(part);
        }
        controller.close();
      },
    }),
  };
}

export const ninaToolInput = {
  request: "Read the page",
  objective: "Gather evidence",
  deliverables: ["definition"],
};

/** The parts of one answer. A stream is used up once, so every call builds its own. */
const ninaAnswer: StreamPart[] = [
  { type: "stream-start", warnings: [] },
  { type: "reasoning-start", id: "reason" },
  {
    type: "reasoning-delta",
    id: "reason",
    delta: "Check the evidence.",
  },
  { type: "reasoning-end", id: "reason" },
  { type: "text-start", id: "answer" },
  {
    type: "text-delta",
    id: "answer",
    delta: "A limit describes the value approached.",
  },
  { type: "text-end", id: "answer" },
  {
    type: "source",
    sourceType: "url",
    id: "source-1",
    url: "https://example.com/limits",
    title: "Limits",
  },
  {
    type: "finish",
    usage: ninaUsage,
    finishReason: { unified: "stop", raw: "stop" },
  },
];

/** A model that answers `count` calls in a row, so a test may run several turns of one chat. */
export function ninaModelFor(count: number) {
  return new MockLanguageModelV4({
    doStream: Arr.makeBy(count, () => ninaStream(ninaAnswer)),
  });
}

/**
 * A model that searches the learner's memories for `query` in its first call,
 * under the call id `recall-1`, and then answers `answers` calls in a row, so a
 * test may run several turns of one chat.
 */
export function ninaRecallModel(query: string, answers: number) {
  return new MockLanguageModelV4({
    doStream: [
      ninaStream([
        { type: "stream-start", warnings: [] },
        {
          type: "tool-call",
          toolCallId: "recall-1",
          toolName: "memory",
          input: encodeJsonText({ query }),
        },
        {
          type: "finish",
          usage: ninaUsage,
          finishReason: { unified: "tool-calls", raw: "tool-calls" },
        },
      ]),
      ...Arr.makeBy(answers, () => ninaStream(ninaAnswer)),
    ],
  });
}

export function ninaModel(
  withTool = false,
  failed = false,
  input: object = ninaToolInput
) {
  const final = ninaStream(
    failed
      ? [{ type: "error", error: new Error("Provider unavailable") }]
      : ninaAnswer
  );
  return new MockLanguageModelV4({
    doStream: withTool
      ? [
          ninaStream([
            { type: "stream-start", warnings: [] },
            {
              type: "tool-call",
              toolCallId: "read-1",
              toolName: "nakafa",
              input: encodeJsonText(input),
            },
            {
              type: "finish",
              usage: ninaUsage,
              finishReason: { unified: "tool-calls", raw: "tool-calls" },
            },
          ]),
          final,
        ]
      : final,
    doGenerate: ({ responseFormat, prompt }) => {
      let text = "Understanding A Function Limit";
      if (encodeJsonText(prompt).includes("Repair the arguments for")) {
        text = encodeJsonText(ninaToolInput);
      } else if (responseFormat?.type === "json") {
        text = encodeJsonText({
          suggestions: ["How does this relate to continuity?"],
        });
      }
      return Promise.resolve({
        content: [{ type: "text", text }],
        finishReason: { unified: "stop", raw: "stop" },
        usage: ninaUsage,
        warnings: [],
      });
    },
  });
}
