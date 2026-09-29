import { GatewayRateLimitError } from "@ai-sdk/gateway";
import { Ref } from "@confect/core";
import { Agent, listUIMessages } from "@convex-dev/agent";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { getNakafaContent } from "@repo/backend/agent/content";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import {
  GatewayConfigurationError,
  getGatewayModel,
} from "@repo/backend/confect/nina/config/provider";
import { runNakafaAgent } from "@repo/backend/confect/nina/nakafa/agent";
import {
  createNinaTest,
  ninaModel,
  ninaStream,
  ninaUsage,
} from "@repo/backend/test/nina";
import { createFocusTest } from "@repo/backend/test/nina/focus";
import { readNakafaContentRefFixture } from "@repo/contents/agent/fixture";
import { NakafaAgentContentRefInputSchema } from "@repo/contents/agent/schema/read";
import {
  AISDKError,
  APICallError,
  NoOutputGeneratedError,
  RetryError,
} from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { Effect } from "effect";

vi.mock("@repo/backend/confect/nina/config/provider", async (original) => ({
  ...(await original<
    typeof import("@repo/backend/confect/nina/config/provider")
  >()),
  getGatewayModel: vi.fn(),
}));
vi.mock("@repo/backend/confect/nina/nakafa/agent", () => ({
  runNakafaAgent: vi.fn(),
}));
vi.mock("@repo/backend/agent/content", () => ({
  getNakafaContent: vi.fn(),
}));

async function fixture(withTool = false) {
  const seeded = await createNinaTest({
    prompt: "Explain a function limit.",
    needsFetch: withTool,
  });
  const { t, identity, ...saved } = seeded;
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
  return { ...seeded, inspect };
}

const run = Ref.getFunctionReference(refs.internal.nina.response.run);

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Nina generation through the real Agent component", () => {
  it.effect.each([
    [429, "provider-busy"],
    [503, "provider-unavailable"],
    [408, "response-timeout"],
    [504, "response-timeout"],
    [413, "input-too-large"],
    [400, "request-rejected"],
    [422, "request-rejected"],
    [401, "service-configuration"],
    [402, "service-configuration"],
    [403, "service-configuration"],
    [404, "service-configuration"],
    [424, "service-configuration"],
    [409, "unknown"],
    [undefined, "unknown"],
  ] as const)(
    "persists a safe reason for provider status %s",
    ([statusCode, reason]) =>
      Effect.gen(function* () {
        const error = new APICallError({
          message: "private provider diagnostic",
          url: "https://provider.example.invalid",
          requestBodyValues: {},
          ...(statusCode === undefined ? {} : { statusCode }),
        });
        const languageModel = new MockLanguageModelV4({
          doStream: ninaStream([{ type: "error", error }]),
        });
        vi.mocked(getGatewayModel).mockReturnValue(
          Effect.succeed(languageModel)
        );
        const f = yield* Effect.promise(() => fixture());
        yield* Effect.promise(() => f.t.action(run, { turnId: f.turnId }));
        const state = yield* Effect.promise(f.inspect);
        expect(state.turn?.state).toMatchObject({ status: "failed", reason });
        expect(state.user?.credits).toBe(10);
        const page = yield* Effect.promise(() =>
          f.owner.query(
            Ref.getFunctionReference(refs.public.nina.messages.list),
            {
              chatId: f.chatId,
              threadId: f.threadId,
              paginationOpts: { cursor: null, numItems: 20 },
            }
          )
        ).pipe(
          Effect.flatMap((value) =>
            Ref.decodeReturns(refs.public.nina.messages.list, value)
          )
        );
        expect(
          page.page.some(
            (message) =>
              message.metadata?.state.status === "failed" &&
              message.metadata.state.reason === reason
          )
        ).toBe(true);
        expect(JSON.stringify(page)).not.toContain(
          "private provider diagnostic"
        );
      })
  );

  it.effect.each([
    [
      new RetryError({
        message: "Retries exhausted",
        reason: "maxRetriesExceeded",
        errors: [new GatewayRateLimitError()],
      }),
      "provider-busy",
    ],
    [
      new NoOutputGeneratedError({ cause: new GatewayRateLimitError() }),
      "provider-busy",
    ],
    [new DOMException("Timed out", "TimeoutError"), "response-timeout"],
    [new DOMException("Aborted", "AbortError"), "interrupted"],
    [new NoOutputGeneratedError(), "unknown"],
    ["unstructured provider failure", "unknown"],
    [
      new AISDKError({
        name: "GatewayError",
        message: "private authentication diagnostic",
      }),
      "service-configuration",
    ],
    [
      Object.assign(new Error("private authentication diagnostic"), {
        name: "GatewayAuthenticationError",
      }),
      "service-configuration",
    ],
  ] as const)(
    "retains the expected reason through SDK error envelopes: %s",
    ([error, reason]) =>
      Effect.gen(function* () {
        vi.mocked(getGatewayModel).mockReturnValue(
          Effect.succeed(
            new MockLanguageModelV4({
              doStream: ninaStream([{ type: "error", error }]),
            })
          )
        );
        const f = yield* Effect.promise(() => fixture());
        yield* Effect.promise(() => f.t.action(run, { turnId: f.turnId }));
        expect((yield* Effect.promise(f.inspect)).turn?.state).toMatchObject({
          status: "failed",
          reason,
        });
      })
  );

  it.effect.each([
    ["content-filter", "content-blocked"],
    ["length", "response-limit"],
    ["tool-calls", "response-limit"],
    ["stop", "unknown"],
    ["error", "unknown"],
    ["other", "unknown"],
  ] as const)(
    "classifies a %s response without final text",
    ([finishReason, reason]) =>
      Effect.gen(function* () {
        vi.mocked(getGatewayModel).mockReturnValue(
          Effect.succeed(
            new MockLanguageModelV4({
              doStream: ninaStream([
                { type: "stream-start", warnings: [] },
                {
                  type: "finish",
                  finishReason: { unified: finishReason, raw: finishReason },
                  usage: ninaUsage,
                },
              ]),
            })
          )
        );
        const f = yield* Effect.promise(() => fixture());
        yield* Effect.promise(() => f.t.action(run, { turnId: f.turnId }));
        const state = yield* Effect.promise(f.inspect);
        expect(state.turn?.state).toMatchObject({ status: "failed", reason });
        expect(state.user?.credits).toBe(10);
      })
  );

  it("identifies missing Gateway configuration before a provider request", async () => {
    vi.mocked(getGatewayModel).mockReturnValue(
      Effect.fail(
        new GatewayConfigurationError({
          message: "AI Gateway is not configured.",
        })
      )
    );
    const f = await fixture();
    await f.t.action(run, { turnId: f.turnId });
    expect((await f.inspect()).turn?.state).toMatchObject({
      status: "failed",
      reason: "service-configuration",
    });
  });

  it.effect("refunds a failure before the Agent stream starts", () =>
    Effect.gen(function* () {
      vi.mocked(getGatewayModel).mockReturnValue(Effect.succeed(ninaModel()));
      vi.spyOn(Agent.prototype, "streamText").mockRejectedValueOnce(
        new GatewayRateLimitError()
      );
      const f = yield* Effect.promise(() => fixture());
      yield* Effect.promise(() => f.t.action(run, { turnId: f.turnId }));
      const state = yield* Effect.promise(f.inspect);
      expect(state.turn?.state).toMatchObject({
        status: "failed",
        reason: "provider-busy",
      });
      expect(state.user?.credits).toBe(10);
      expect(state.ledger.filter((row) => row.type === "refund")).toHaveLength(
        1
      );
    })
  );

  it.effect("keeps an answer when the provider omits usage counters", () =>
    Effect.gen(function* () {
      const languageModel = ninaModel();
      languageModel.doStream = async () =>
        ninaStream([
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: "answer" },
          { type: "text-delta", id: "answer", delta: "A recorded answer." },
          { type: "text-end", id: "answer" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: "stop" },
            usage: {
              inputTokens: {
                total: undefined,
                noCache: undefined,
                cacheRead: undefined,
                cacheWrite: undefined,
              },
              outputTokens: {
                total: undefined,
                text: undefined,
                reasoning: undefined,
              },
            },
          },
        ]);
      vi.mocked(getGatewayModel).mockReturnValue(Effect.succeed(languageModel));
      const f = yield* Effect.promise(() => fixture());
      yield* Effect.promise(() => f.t.action(run, { turnId: f.turnId }));
      const state = yield* Effect.promise(f.inspect);
      expect(state.turn?.state.status).toBe("complete");
      expect(
        state.turn?.usage.find((row) => row.agent === "nina")
      ).toMatchObject({ input: 0, output: 0 });
    })
  );

  it.effect("retains the first stream failure through abort cleanup", () =>
    Effect.gen(function* () {
      vi.mocked(getGatewayModel).mockReturnValue(Effect.succeed(ninaModel()));
      vi.spyOn(Agent.prototype, "streamText").mockImplementationOnce(
        async (_ctx, _thread, options) => {
          await options.onError?.({ error: new GatewayRateLimitError() });
          await options.onError?.({ error: new Error("cleanup failure") });
          await options.onAbort?.({ callId: "cancelled", steps: [] });
          return Promise.reject(new Error("stream cleanup failed"));
        }
      );
      const f = yield* Effect.promise(() => fixture());
      yield* Effect.promise(() => f.t.action(run, { turnId: f.turnId }));
      expect((yield* Effect.promise(f.inspect)).turn?.state).toMatchObject({
        status: "failed",
        reason: "provider-busy",
      });
    })
  );

  it.effect("records an Agent abort without exposing its diagnostic", () =>
    Effect.gen(function* () {
      vi.mocked(getGatewayModel).mockReturnValue(Effect.succeed(ninaModel()));
      vi.spyOn(Agent.prototype, "streamText").mockImplementationOnce(
        async (_ctx, _thread, options) => {
          await options.onAbort?.({ callId: "cancelled", steps: [] });
          return Promise.reject(new Error("private abort diagnostic"));
        }
      );
      const f = yield* Effect.promise(() => fixture());
      yield* Effect.promise(() => f.t.action(run, { turnId: f.turnId }));
      const state = yield* Effect.promise(f.inspect);
      expect(state.turn?.state).toMatchObject({
        status: "failed",
        reason: "interrupted",
      });
      expect(state.user?.credits).toBe(10);
    })
  );

  it("persists reasoning, sources and the final answer before optional presentation", async () => {
    const languageModel = ninaModel();
    vi.mocked(getGatewayModel).mockReturnValue(Effect.succeed(languageModel));
    const f = await fixture();
    await f.t.mutation((ctx) =>
      ctx.db.patch("ninaTurns", f.turnId, {
        user: {
          role: "teacher",
          curriculumPreference: {
            program: {
              key: "cambridge-lower-secondary",
              title: "Cambridge Lower Secondary",
            },
          },
        },
      })
    );
    await f.t.action(run, { turnId: f.turnId });
    const state = await f.inspect();
    expect(state.turn?.state.status).toBe("complete");
    expect(state.turn?.suggestions).toBeUndefined();
    expect(state.turn?.usage.map((row) => row.agent)).toEqual(["nina"]);
    expect(state.chat?.activeTurnId).toBeUndefined();
    expect(languageModel.doGenerateCalls).toHaveLength(0);
    expect(state.user?.credits).toBe(8);
    expect(state.messages.page).toHaveLength(2);
    const answer = state.messages.page.find(
      (message) => message.role === "assistant"
    );
    expect(answer?.parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "reasoning",
          text: "Check the evidence.",
        }),
        expect.objectContaining({
          type: "text",
          text: "A limit describes the value approached.",
        }),
        expect.objectContaining({
          type: "source-url",
          url: "https://example.com/limits",
        }),
      ])
    );
    expect(JSON.stringify(languageModel.doStreamCalls[0]?.prompt)).toContain(
      "Cambridge Lower Secondary"
    );
    expect(JSON.stringify(languageModel.doStreamCalls[0]?.prompt)).toContain(
      "teacher"
    );
  });

  it("keeps progressive tool cards in permanent messages after the live stream ends", async () => {
    vi.useRealTimers();
    const languageModel = ninaModel(true);
    vi.mocked(getGatewayModel).mockReturnValue(Effect.succeed(languageModel));
    const input = {
      content_ref: NakafaAgentContentRefInputSchema.make(
        "https://nakafa.com/en/home"
      ),
    };
    vi.mocked(runNakafaAgent).mockImplementation(({ publish }) =>
      Effect.gen(function* () {
        yield* publish({
          id: "read-1",
          type: "data-nakafa",
          data: { kind: "content", status: "loading", input },
        });
        yield* publish({
          id: "read-1",
          type: "data-nakafa",
          data: {
            kind: "content",
            status: "error",
            input,
            error: "Fixture evidence unavailable",
          },
        });
        return { text: "Fixture evidence unavailable" };
      })
    );
    const f = await fixture();
    await f.t.action(run, { turnId: f.turnId });
    await f.t.finishAllScheduledFunctions(() => undefined);
    const state = await f.inspect();
    expect(state.turn?.state.status).toBe("complete");
    expect(languageModel.doStreamCalls).toHaveLength(2);
    expect(
      languageModel.doStreamCalls[1]?.prompt.filter(
        (message) => message.role === "tool"
      )
    ).toEqual([
      {
        role: "tool",
        content: [
          expect.objectContaining({
            type: "tool-result",
            toolCallId: "read-1",
            output: { type: "text", value: "Fixture evidence unavailable" },
          }),
        ],
      },
    ]);
    const answer = state.messages.page.find(
      (message) => message.role === "assistant"
    );
    expect(answer?.parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "tool-nakafa",
          state: "output-available",
          output: {
            text: "Fixture evidence unavailable",
            artifacts: [
              {
                id: "read-1",
                type: "data-nakafa",
                data: {
                  kind: "content",
                  status: "error",
                  input: { content_ref: "https://nakafa.com/en/home" },
                  error: "Fixture evidence unavailable",
                },
              },
            ],
          },
        }),
      ])
    );
    expect(state.turn?.usage.find((row) => row.agent === "nina")?.calls).toBe(
      2
    );
  });

  it("refunds an interrupted provider without generating a title or follow-up", async () => {
    const languageModel = ninaModel(false, true);
    vi.mocked(getGatewayModel).mockReturnValue(Effect.succeed(languageModel));
    const f = await fixture();
    await f.t.action(run, { turnId: f.turnId });
    const state = await f.inspect();
    expect(state.turn?.state.status).toBe("failed");
    expect(state.user?.credits).toBe(10);
    expect(state.ledger.filter((row) => row.type === "refund")).toHaveLength(1);
    expect(languageModel.doGenerateCalls).toHaveLength(0);
  });

  it("sends the rolling summary and omits the turns it covers", async () => {
    const languageModel = ninaModel();
    vi.mocked(getGatewayModel).mockReturnValue(Effect.succeed(languageModel));
    const f = await createNinaTest({ history: 6 });
    await f.t.mutation((ctx) =>
      ctx.db.insert("ninaSummaries", {
        chatId: f.chatId,
        text: "- The learner practiced limits.",
        throughOrder: 3,
        updatedAt: Date.now(),
      })
    );
    await f.t.action(run, { turnId: f.turnId });
    const prompt = JSON.stringify(languageModel.doStreamCalls[0]?.prompt);
    expect(prompt).toContain("# Conversation Summary");
    expect(prompt).toContain("- The learner practiced limits.");
    expect(prompt).not.toContain("Earlier question 3");
    expect(prompt).toContain("Earlier question 4");
    expect(prompt).toContain("Earlier answer 5");
  });

  it("places the verified current page in the prompt without forcing a tool", async () => {
    const languageModel = ninaModel();
    vi.mocked(getGatewayModel).mockReturnValue(Effect.succeed(languageModel));
    vi.mocked(getNakafaContent).mockReturnValue(
      Effect.succeedSome({
        ...readNakafaContentRefFixture("en", "home", "material"),
        text: "## Limits\n\nA limit describes the value a function approaches.",
        title: "Limits",
      })
    );
    const f = await fixture(true);
    await f.t.action(run, { turnId: f.turnId });
    const state = await f.inspect();
    expect(state.turn?.state.status).toBe("complete");
    const call = languageModel.doStreamCalls[0];
    expect(JSON.stringify(call?.prompt)).toContain("# Current Page");
    expect(JSON.stringify(call?.prompt)).toContain(
      "A limit describes the value a function approaches."
    );
    expect(call?.toolChoice).not.toEqual({
      type: "tool",
      toolName: "nakafa",
    });
    expect(runNakafaAgent).not.toHaveBeenCalled();
  });

  it("answers a focused question from its signed body and official explanation", async () => {
    const languageModel = ninaModel();
    vi.mocked(getGatewayModel).mockReturnValue(Effect.succeed(languageModel));
    const f = await createFocusTest();
    await f.focusTurn();
    await f.t.action(run, { turnId: f.turnId });
    const turn = await f.t.query((ctx) => ctx.db.get("ninaTurns", f.turnId));
    expect(turn?.state.status).toBe("complete");
    const prompt = JSON.stringify(languageModel.doStreamCalls[0]?.prompt);
    expect(prompt).toContain("# Focused Try-out Question");
    expect(prompt).toContain("Technical question");
    expect(prompt).toContain("Technical answer");
    expect(prompt).toContain("# Focused Question Instructions");
  });

  it("refunds a focused turn whose question is no longer entitled", async () => {
    const languageModel = ninaModel();
    vi.mocked(getGatewayModel).mockReturnValue(Effect.succeed(languageModel));
    const f = await createFocusTest();
    await f.focusTurn();
    await f.t.mutation((ctx) =>
      ctx.db.patch("users", f.identity.userId, { plan: "free" })
    );
    await f.t.action(run, { turnId: f.turnId });
    const state = await f.t.query(async (ctx) => ({
      turn: await ctx.db.get("ninaTurns", f.turnId),
      user: await ctx.db.get("users", f.identity.userId),
    }));
    expect(state.turn?.state).toMatchObject({
      status: "failed",
      reason: "unknown",
    });
    expect(state.user?.credits).toBe(10);
    expect(languageModel.doStreamCalls).toHaveLength(0);
  });
});
