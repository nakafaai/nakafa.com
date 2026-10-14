import { Ref } from "@confect/core";
import { RegisteredFunction } from "@confect/server";
import { createThread, saveMessage } from "@convex-dev/agent";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import schema from "@repo/backend/confect/_generated/schema";
import ninaTurns from "@repo/backend/confect/_generated/tables/ninaTurns";
import { languageModel } from "@repo/backend/confect/gateway/model";
import { readInput } from "@repo/backend/confect/nina/input";
import { runNakafaAgent } from "@repo/backend/confect/nina/nakafa/agent";
import type { NinaInput } from "@repo/backend/confect/nina/turns.spec";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { deployment, provider } from "@repo/backend/test/gateway";
import {
  appendNinaTurn,
  createNinaTest,
  ninaModel,
  ninaModelFor,
} from "@repo/backend/test/nina";
import { createFocusTest } from "@repo/backend/test/nina/focus";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Effect, Option, Schema } from "effect";

vi.mock("@repo/backend/confect/gateway/live", async () => ({
  GatewayLive: (await import("@repo/backend/test/gateway")).GatewayTest,
}));
vi.mock("@repo/backend/confect/nina/nakafa/agent", () => ({
  runNakafaAgent: vi.fn(),
}));

const run = Ref.getFunctionReference(refs.internal.nina.response.run);
const start = Ref.getFunctionReference(refs.public.nina.turns.start);
const CONTEXT = "Runtime facts";

/** Reads the model input of the fixture's turn, or the typed failure's reason. */
async function inputFor(
  nina: Awaited<ReturnType<typeof createNinaTest>>,
  through: number | null = null
) {
  const turn = Schema.decodeUnknownSync(ninaTurns.Doc)(
    await nina.t.query((ctx) => ctx.db.get("ninaTurns", nina.turnId))
  );
  return nina.t.action((ctx) =>
    Effect.runPromise(
      readInput(turn, { context: CONTEXT, through }).pipe(
        Effect.catchTag("NinaGenerationError", (error) =>
          Effect.succeed(error.reason)
        ),
        Effect.provide(RegisteredFunction.actionLayer(schema, ctx))
      )
    )
  );
}

/** The role and the parts of a message, whether the Agent's or the model's. */
const Outlined = Schema.Array(
  Schema.Struct({
    content: Schema.Union([
      Schema.String,
      Schema.Array(
        Schema.Struct({
          text: Schema.optionalKey(Schema.String),
          type: Schema.String,
        })
      ),
    ]),
    role: Schema.String,
  })
);

/** One line per message: its role, then its text parts, with a mark for any other part. */
function outline(messages: unknown) {
  if (typeof messages === "string") {
    return messages;
  }
  return Arr.map(
    Schema.decodeUnknownSync(Outlined)(messages),
    ({ content, role }) => {
      const parts =
        typeof content === "string"
          ? [content]
          : Arr.map(content, (part) =>
              part.type === "text" ? (part.text ?? "") : `[${part.type}]`
            );
      return `${role}: ${Arr.join(parts, " | ")}`;
    }
  );
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.restoreAllMocks();
  deployment.mockReset();
  provider.languageModel.mockReset();
  vi.useRealTimers();
});

describe("Nina model input by turn order", () => {
  it("reads the complete turns after the summary whole, in order, then the question with its runtime facts", async () => {
    const f = await createNinaTest({ history: 3 });
    expect(outline(await inputFor(f))).toEqual([
      "user: Earlier question 0",
      "assistant: Earlier answer 0",
      "user: Earlier question 1",
      "assistant: Earlier answer 1",
      "user: Earlier question 2",
      "assistant: Earlier answer 2",
      `user: ${CONTEXT} | Explain a limit.`,
    ]);
  });

  it("leaves out the turns the summary covers", async () => {
    const f = await createNinaTest({ history: 3 });
    expect(outline(await inputFor(f, 1))).toEqual([
      "user: Earlier question 2",
      "assistant: Earlier answer 2",
      `user: ${CONTEXT} | Explain a limit.`,
    ]);
  });

  it("is not shifted by a cancelled turn, which neither uncovers a covered turn nor leaves a tool call", async () => {
    // Orders 0 and 1 are complete, and order 2 was cancelled after a tool step.
    const f = await createNinaTest({ history: [{}, {}, { cancelled: true }] });
    expect(outline(await inputFor(f))).toEqual([
      "user: Earlier question 0",
      "assistant: Earlier answer 0",
      "user: Earlier question 1",
      "assistant: Earlier answer 1",
      `user: ${CONTEXT} | Explain a limit.`,
    ]);
    // The summary covers order 1. Counting turns back from the current one, as
    // the code did before, took the cancelled turn for a turn and showed it.
    expect(outline(await inputFor(f, 1))).toEqual([
      `user: ${CONTEXT} | Explain a limit.`,
    ]);
  });

  it("reads a turn of more messages than the fifty the Agent used to fetch", async () => {
    const f = await createNinaTest({ history: [{}, { steps: 30 }] });
    const input = outline(await inputFor(f));
    // Two messages of the first turn, 62 of the second, and the question.
    expect(input).toHaveLength(2 + 62 + 1);
    expect(input[0]).toBe("user: Earlier question 0");
    expect(input[2]).toBe("user: Earlier question 1");
  });

  it("reads every turn the summary has not folded, however many steps they took", async () => {
    // Five turns of 42 messages are more than the four pages of fifty the read once took.
    const f = await createNinaTest({
      history: Arr.makeBy(5, () => ({ steps: 20 })),
    });
    const input = outline(await inputFor(f));
    expect(input).toHaveLength(5 * 42 + 1);
    expect(input[0]).toBe("user: Earlier question 0");
  });

  it.each([
    ["a question asked again, in its newest asking", [{}, { retryOf: 0 }], 1],
    [
      "a question retried twice, in its newest asking",
      [{}, { retryOf: 0 }, { retryOf: 0 }],
      2,
    ],
    [
      "a question whose retry never completed, in its one complete asking",
      [{}, { cancelled: true, retryOf: 0 }],
      0,
    ],
  ] as const)("shows %s once", async (_case, history, answer) => {
    const f = await createNinaTest({ history });
    expect(outline(await inputFor(f))).toEqual([
      "user: Earlier question 0",
      `assistant: Earlier answer ${answer}`,
      `user: ${CONTEXT} | Explain a limit.`,
    ]);
  });

  it("hides the turn that the current turn answers again", async () => {
    const f = await createNinaTest({
      history: 2,
      prompt: "Earlier question 0",
    });
    await f.t.mutation((ctx) =>
      ctx.db.patch("ninaTurns", f.turnId, { retryOf: 0 })
    );
    expect(outline(await inputFor(f))).toEqual([
      "user: Earlier question 1",
      "assistant: Earlier answer 1",
      `user: ${CONTEXT} | Earlier question 0`,
    ]);
  });

  it.each([
    ["an asking that was retried before", [{}, { retryOf: 0 }]],
    ["a retry that never completed", [{}, { cancelled: true, retryOf: 0 }]],
  ] as const)(
    "shows the question once when the current turn retries %s",
    async (_case, history) => {
      const f = await createNinaTest({ history, prompt: "Earlier question 0" });
      await f.t.mutation((ctx) =>
        ctx.db.patch("ninaTurns", f.turnId, { retryOf: 0 })
      );
      expect(outline(await inputFor(f))).toEqual([
        `user: ${CONTEXT} | Earlier question 0`,
      ]);
    }
  );

  it("leaves out an earlier turn that lost its question, rather than show an answer with none", async () => {
    const f = await createNinaTest({ history: 2 });
    const [first] = await f.t.query((ctx) =>
      ctx.db
        .query("ninaTurns")
        .withIndex("by_chatId_and_order", (q) =>
          q.eq("chatId", f.chatId).eq("order", 0)
        )
        .collect()
    );
    await f.t.mutation((ctx) =>
      ctx.runMutation(components.nina.messages.deleteByIds, {
        messageIds: [first?.promptMessageId ?? ""],
      })
    );
    expect(outline(await inputFor(f))).toEqual([
      "user: Earlier question 1",
      "assistant: Earlier answer 1",
      `user: ${CONTEXT} | Explain a limit.`,
    ]);
  });

  it("fails the turn when its question is no longer in the thread", async () => {
    const f = await createNinaTest({ history: 1 });
    await f.t.mutation((ctx) =>
      ctx.runMutation(components.nina.messages.deleteByIds, {
        messageIds: [f.promptMessageId],
      })
    );
    expect(await inputFor(f)).toBe("unknown");
  });

  it("fails the turn when the turns after the summary cannot be listed", async () => {
    const f = await createNinaTest({ history: 1 });
    // No turn comes before the first.
    expect(await inputFor(f, -1)).toBe("unknown");
  });

  it("fails the turn when its thread cannot be read", async () => {
    const f = await createNinaTest({ history: 1 });
    await f.t.mutation(async (ctx) => {
      // The Agent component refuses a prompt that belongs to another thread.
      const elsewhere = await saveMessage(ctx, components.nina, {
        threadId: await createThread(ctx, components.nina, {
          userId: f.identity.userId,
        }),
        prompt: "Elsewhere",
      });
      await ctx.db.patch("ninaTurns", f.turnId, {
        promptMessageId: elsewhere.messageId,
      });
    });
    expect(await inputFor(f)).toBe("unknown");
  });
});

/** What a model call received before the learner's newest message: the system prompt and the history. */
function prefixOf<Message extends { role: string }>(
  prompt: readonly Message[]
) {
  const newest = Arr.findLastIndex(prompt, ({ role }) => role === "user");
  return Arr.take(
    prompt,
    Option.getOrElse(newest, () => 0)
  );
}

/** The last message a model call received. */
function newestOf<Message>(prompt: readonly Message[]) {
  return Option.getOrThrow(Arr.last(prompt));
}

/** The cache marker as the request body carries it, from the language model profile. */
const CACHE_MARKER = `,"providerOptions":${encodeJsonText({ openaiCompatible: languageModel.cache.marker })}`;

/**
 * Messages as text without the cache marker. The marker only says where the
 * prefix ends, so it moves when a turn adds messages to the prefix.
 */
function unmarked(messages: unknown) {
  return encodeJsonText(messages).replaceAll(CACHE_MARKER, "");
}

describe("The cached prefix of the model input", () => {
  it("repeats byte for byte from one step of a turn to the next, and the runtime facts follow it", async () => {
    // The progressive tool card streams on timers.
    vi.useRealTimers();
    const model = ninaModel(true);
    provider.languageModel.mockReturnValue(model);
    vi.mocked(runNakafaAgent).mockReturnValue(
      Effect.succeed({ text: "Verified evidence" })
    );
    const f = await createNinaTest({ history: 2 });
    await f.t.action(run, { turnId: f.turnId });
    const [first, later] = model.doStreamCalls;
    expect(model.doStreamCalls).toHaveLength(2);
    expect(prefixOf(first?.prompt ?? [])).toHaveLength(1 + 4);
    expect(encodeJsonText(prefixOf(later?.prompt ?? []))).toBe(
      encodeJsonText(prefixOf(first?.prompt ?? []))
    );
    // The later step went on after the question, with the tool call and its result.
    expect(
      Arr.takeRight(
        Arr.map(later?.prompt ?? [], ({ role }) => role),
        3
      )
    ).toEqual(["user", "assistant", "tool"]);
    const system = encodeJsonText(first?.prompt[0]);
    expect(system).not.toContain("- date:");
    expect(system).not.toContain("https://nakafa.com/en/home");
    const question = encodeJsonText(first?.prompt[5]);
    expect(question).toContain("- date:");
    expect(question).toContain("- url: https://nakafa.com/en/home");
  });

  it("repeats byte for byte from one turn of a chat to the next on one page, adding only the question and the answer", async () => {
    const model = ninaModelFor(2);
    provider.languageModel.mockReturnValue(model);
    vi.setSystemTime(Date.UTC(2026, 9, 11, 9));
    const f = await createNinaTest({ history: 1 });
    await f.t.action(run, { turnId: f.turnId });
    vi.setSystemTime(Date.UTC(2026, 9, 11, 10));
    const next = await appendNinaTurn(f, { prompt: "And at infinity?" });
    await f.t.action(run, { turnId: next.turnId });
    const [one, two] = model.doStreamCalls;
    const before = prefixOf(one?.prompt ?? []);
    expect(unmarked(Arr.take(two?.prompt ?? [], before.length))).toBe(
      unmarked(before)
    );
    // The cache marker sits on the last message before the question, in each.
    expect(encodeJsonText(newestOf(before))).toContain(CACHE_MARKER);
    expect(encodeJsonText(newestOf(prefixOf(two?.prompt ?? [])))).toContain(
      CACHE_MARKER
    );
    // After it come the first question as stored, without runtime facts, and its answer.
    expect(
      outline(Arr.drop(prefixOf(two?.prompt ?? []), before.length))
    ).toEqual([
      "user: Explain a limit.",
      "assistant: A limit describes the value approached.",
    ]);
    expect(encodeJsonText(newestOf(one?.prompt ?? []))).toContain(
      "2026-10-11T09:00:00.000Z"
    );
    expect(encodeJsonText(newestOf(two?.prompt ?? []))).toContain(
      "2026-10-11T10:00:00.000Z"
    );
  });

  it("keeps the system prompt when the learner moves to another page, and names the page in the message", async () => {
    const model = ninaModelFor(2);
    provider.languageModel.mockReturnValue(model);
    const f = await createNinaTest();
    await f.t.action(run, { turnId: f.turnId });
    const next = await appendNinaTurn(f, {
      prompt: "And here?",
      slug: "chat",
    });
    await f.t.action(run, { turnId: next.turnId });
    const [one, two] = model.doStreamCalls;
    expect(unmarked(two?.prompt[0])).toBe(unmarked(one?.prompt[0]));
    const newest = encodeJsonText(newestOf(two?.prompt ?? []));
    expect(newest).toContain("- url: https://nakafa.com/en/chat");
    expect(newest).not.toContain("https://nakafa.com/en/home");
  });

  it("keeps the system prompt, with its question focus, from one turn of a focused chat to the next", async () => {
    const model = ninaModelFor(2);
    provider.languageModel.mockReturnValue(model);
    const f = await createFocusTest();
    await f.focusTurn();
    await f.t.action(run, { turnId: f.turnId });
    const next = await appendNinaTurn(f, { prompt: "And the other choices?" });
    // Admission keeps a conversation's focus for its follow-up turns.
    await f.focusTurn(next.turnId);
    await f.t.action(run, { turnId: next.turnId });
    const [one, two] = model.doStreamCalls;
    expect(encodeJsonText(one?.prompt[0])).toContain(
      "# Focused Try-out Question"
    );
    expect(unmarked(two?.prompt[0])).toBe(unmarked(one?.prompt[0]));
  });
});

const QUESTION = "Explain a distinctive limit.";
const ANSWER = "A limit describes the value approached.";
const ASK = {
  kind: "message",
  prompt: { text: QUESTION },
  page: { locale: "en", slug: "home" },
} as const;

/** A learner who asks and retries through admission, with each admitted turn generated. */
async function learner() {
  const t = createConvexTestWithBetterAuth();
  const identity = await t.mutation((ctx) =>
    seedAuthenticatedUser(ctx, { now: Date.UTC(2026, 9, 11), credits: 40 })
  );
  const owner = t.withIdentity({
    subject: identity.authUserId,
    sessionId: identity.sessionId,
  });
  let requests = 0;
  /** Admits one turn as the browser does, generates its answer, and returns its receipt. */
  async function converse(
    input: typeof NinaInput.Encoded,
    chatId?: Docs["chats"]["_id"]
  ) {
    requests += 1;
    const receipt = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await owner.mutation(start, {
        requestId: `request-${requests}`,
        ...(chatId === undefined ? {} : { chatId }),
        input,
      })
    );
    await t.action(run, { turnId: receipt.turnId });
    return receipt;
  }
  return { converse, t };
}

describe("Nina model input after a retry", () => {
  it("holds the question once, through admission and generation, however often it is retried and from whichever asking", async () => {
    const model = ninaModelFor(4);
    provider.languageModel.mockReturnValue(model);
    const { converse, t } = await learner();
    const first = await converse(ASK);
    const second = await converse(
      { kind: "retry", order: first.order },
      first.chatId
    );
    // The learner retries the retry, then the first asking again.
    await converse({ kind: "retry", order: second.order }, first.chatId);
    await converse({ kind: "retry", order: first.order }, first.chatId);
    expect(model.doStreamCalls).toHaveLength(4);
    // Each retry holds the question once, and the answers it replaces are gone.
    for (const call of Arr.drop(model.doStreamCalls, 1)) {
      const input = encodeJsonText(call.prompt);
      expect(input.split(QUESTION)).toHaveLength(2);
      expect(input).not.toContain(ANSWER);
    }
    expect(
      (await t.query((ctx) => ctx.db.get("ninaTurns", second.turnId)))?.retryOf
    ).toBe(first.order);
  });

  it("names the page the learner retries from, not the page the question was asked on", async () => {
    const model = ninaModelFor(3);
    provider.languageModel.mockReturnValue(model);
    const { converse } = await learner();
    const first = await converse(ASK);
    // The question was asked on the home page. The learner retries it on the
    // chat page, then back on the home page.
    await converse(
      {
        kind: "retry",
        order: first.order,
        page: { locale: "en", slug: "chat" },
      },
      first.chatId
    );
    await converse(
      {
        kind: "retry",
        order: first.order,
        page: { locale: "en", slug: "home" },
      },
      first.chatId
    );
    const [, elsewhere, back] = model.doStreamCalls;
    const away = encodeJsonText(newestOf(elsewhere?.prompt ?? []));
    expect(away).toContain("- url: https://nakafa.com/en/chat");
    expect(away).not.toContain("https://nakafa.com/en/home");
    expect(encodeJsonText(newestOf(back?.prompt ?? []))).toContain(
      "- url: https://nakafa.com/en/home"
    );
  });
});
