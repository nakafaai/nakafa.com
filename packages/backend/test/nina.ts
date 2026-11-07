import { RegisteredConvexFunction } from "@confect/server";
import { createThread, listUIMessages, saveMessage } from "@convex-dev/agent";
import { components } from "@repo/backend/confect/_generated/components";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import schema from "@repo/backend/confect/_generated/schema";
import usersTable from "@repo/backend/confect/_generated/tables/users";
import { openNinaLearningSession } from "@repo/backend/confect/nina/contract/pack";
import { reserveCredits } from "@repo/backend/confect/nina/credits/ledger";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  type EarlierTurn,
  plainTurns,
  seedEarlierTurn,
} from "@repo/backend/test/nina/history";
import { encodeJsonText } from "@repo/utilities/json";
import { MockLanguageModelV4 } from "ai/test";
import { Array as Arr, DateTime, Effect, Option, Schema } from "effect";

/** Reads a raw account the way Confect reads it, so its animal is decoded. */
const decodeUser = Schema.decodeUnknownSync(usersTable.Doc);

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
    reserveCredits(decodeUser(user)).pipe(
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
  // The raw writer takes a mutable list, and the hold's draws are read-only.
  const { lots, ...hold } = reservation;
  const turnId = await ctx.db.insert("ninaTurns", {
    ...hold,
    ...(lots === undefined ? {} : { lots: Arr.copy(lots) }),
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
 * credit ledger, and messages. It is seeded in one mutation: convex-test runs
 * each mutation after the commits before it, as Convex does, so under a frozen
 * clock the first write of a test keeps its moment.
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
  const { identity, ...saved } = await t.mutation(async (ctx) => {
    const identity = await seedAuthenticatedUser(ctx, { now, credits: 10 });
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
    return { ...turn, threadId, chatId, identity };
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
 * Fires the jobs that are due and none that wait: a job scheduled at once is due
 * a millisecond past a frozen clock once convex-test pins a commit after it.
 */
export const fireDueJobs = () => vi.advanceTimersByTime(1);

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

/** The calls of a test model that wrote answers, without the follow-ups that stream after them. */
export function answerCalls(model: MockLanguageModelV4) {
  return Arr.filter(
    model.doStreamCalls,
    (call) => call.responseFormat?.type !== "json"
  );
}

/** The calls of a test model that wrote follow-ups: they ask for JSON and stream. */
export function followUpCalls(model: MockLanguageModelV4) {
  return Arr.filter(
    model.doStreamCalls,
    (call) => call.responseFormat?.type === "json"
  );
}

/** Answers the follow-up call of a test model with `followUps`, and every other call as the model already does. */
export function answerFollowUps(
  model: MockLanguageModelV4,
  followUps: () => ReturnType<MockLanguageModelV4["doStream"]>
) {
  const answer = model.doStream;
  model.doStream = (options) =>
    options.responseFormat?.type === "json" ? followUps() : answer(options);
}

/** The follow-up the test model writes after an answer. */
const NINA_SUGGESTIONS = ["How does this relate to continuity?"];

/** The text a follow-up object starts with, before its first question. */
const SUGGESTIONS_OPENING = '{"suggestions":[';

/**
 * The parts of a follow-up stream that writes `suggestions` as one JSON object
 * in two deltas, so a stream reads it before it ends. With two or more
 * questions the first delta ends a few letters into the second, the point at
 * which a reader knows the first is finished. With `failAfter`, the stream
 * fails after its first delta.
 */
export function ninaSuggestionStream(
  suggestions: readonly string[] = NINA_SUGGESTIONS,
  failAfter = false
) {
  const text = encodeJsonText({ suggestions });
  const [first = "", second] = suggestions;
  const middle =
    second === undefined
      ? Math.floor(text.length / 2)
      : SUGGESTIONS_OPENING.length + encodeJsonText(first).length + 4;
  return ninaStream([
    { type: "stream-start", warnings: [] },
    { type: "text-start", id: "suggestions" },
    { type: "text-delta", id: "suggestions", delta: text.slice(0, middle) },
    ...(failAfter
      ? [{ type: "error" as const, error: new Error("Provider unavailable") }]
      : [
          {
            type: "text-delta" as const,
            id: "suggestions",
            delta: text.slice(middle),
          },
          { type: "text-end" as const, id: "suggestions" },
          {
            type: "finish" as const,
            usage: ninaUsage,
            finishReason: { unified: "stop" as const, raw: "stop" },
          },
        ]),
  ]);
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
  const answers = withTool
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
    : [final];
  let answered = 0;
  return new MockLanguageModelV4({
    // The follow-ups ask for JSON and stream on their own; every other call
    // takes the next answer, and the last answer once they are used up.
    doStream: (options) => {
      if (options.responseFormat?.type === "json") {
        return Promise.resolve(ninaSuggestionStream());
      }
      const answer = Option.getOrThrow(
        Arr.get(answers, Math.min(answered, answers.length - 1))
      );
      answered += 1;
      return Promise.resolve(answer);
    },
    doGenerate: ({ responseFormat, prompt }) => {
      let text = "Understanding A Function Limit";
      if (encodeJsonText(prompt).includes("Repair the arguments for")) {
        text = encodeJsonText(ninaToolInput);
      } else if (responseFormat?.type === "json") {
        text = encodeJsonText({ suggestions: NINA_SUGGESTIONS });
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

/** Gives a fixture's learner the credits for turns after the first, which a fixture starts with its ten. */
export async function fundLearner(
  f: Pick<Awaited<ReturnType<typeof createNinaTest>>, "identity" | "t">
) {
  await f.t.mutation((ctx) =>
    ctx.db.patch("users", f.identity.userId, { credits: 100 })
  );
}
