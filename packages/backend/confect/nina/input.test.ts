import { Ref } from "@confect/core";
import { RegisteredFunction } from "@confect/server";
import { createThread, saveMessage } from "@convex-dev/agent";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import schema from "@repo/backend/confect/_generated/schema";
import ninaTurns from "@repo/backend/confect/_generated/tables/ninaTurns";
import { readInput } from "@repo/backend/confect/nina/input";
import { runNakafaAgent } from "@repo/backend/confect/nina/nakafa/agent";
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

  it("holds four turns of twenty steps, and drops a fifth that its pages cannot hold whole", async () => {
    const f = await createNinaTest({
      history: Arr.makeBy(5, () => ({ steps: 20 })),
    });
    const input = outline(await inputFor(f));
    expect(input).toHaveLength(4 * 42 + 1);
    expect(input[0]).toBe("user: Earlier question 1");
  });

  it("shows a question the learner asked again once, in its newest asking", async () => {
    const f = await createNinaTest({ history: [{}, { retryOf: 0 }] });
    expect(outline(await inputFor(f))).toEqual([
      "user: Earlier question 0",
      "assistant: Earlier answer 1",
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

  it("follows a chain of retries to the newest asking", async () => {
    const f = await createNinaTest({
      history: [{}, { retryOf: 0 }, { retryOf: 1 }],
    });
    expect(outline(await inputFor(f))).toEqual([
      "user: Earlier question 1",
      "assistant: Earlier answer 2",
      `user: ${CONTEXT} | Explain a limit.`,
    ]);
  });

  it("keeps the earlier turn when its retry never completed", async () => {
    const f = await createNinaTest({
      history: [{}, { cancelled: true, retryOf: 0 }],
    });
    expect(outline(await inputFor(f))).toEqual([
      "user: Earlier question 0",
      "assistant: Earlier answer 0",
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

const CACHE_MARKER =
  ',"providerOptions":{"openaiCompatible":{"cache_control":{"type":"ephemeral"}}}';

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
});

describe("Nina model input after a retry", () => {
  it("holds the question once, through admission and generation", async () => {
    const model = ninaModelFor(2);
    provider.languageModel.mockReturnValue(model);
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: Date.UTC(2026, 9, 11), credits: 20 })
    );
    const owner = t.withIdentity({
      subject: identity.authUserId,
      sessionId: identity.sessionId,
    });
    const first = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await owner.mutation(start, {
        requestId: "one",
        input: {
          kind: "message",
          prompt: { text: "Explain a distinctive limit." },
          page: { locale: "en", slug: "home" },
        },
      })
    );
    await t.action(run, { turnId: first.turnId });
    const retried = Ref.decodeReturnsSync(
      refs.public.nina.turns.start,
      await owner.mutation(start, {
        requestId: "two",
        chatId: first.chatId,
        input: { kind: "retry", order: first.order },
      })
    );
    await t.action(run, { turnId: retried.turnId });
    expect(model.doStreamCalls).toHaveLength(2);
    const retry = encodeJsonText(model.doStreamCalls[1]?.prompt);
    // Once for the question, and the answer it replaces is gone.
    expect(retry.split("Explain a distinctive limit.")).toHaveLength(2);
    expect(retry).not.toContain("A limit describes the value approached.");
    expect(
      (await t.query((ctx) => ctx.db.get("ninaTurns", retried.turnId)))?.retryOf
    ).toBe(first.order);
  });
});
