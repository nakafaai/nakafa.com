import { Ref } from "@confect/core";
import { Agent } from "@convex-dev/agent";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { languageModel as profile } from "@repo/backend/confect/gateway/model";
import { runNakafaAgent } from "@repo/backend/confect/nina/nakafa/agent";
import { deployment, failures, provider } from "@repo/backend/test/gateway";
import {
  appendNinaTurn,
  createNinaTest,
  ninaModel,
  ninaModelFor,
  ninaStream,
  ninaToolInput,
  ninaUsage,
} from "@repo/backend/test/nina";
import { createPortraitTest } from "@repo/backend/test/nina/portrait";
import { sealedSummary } from "@repo/backend/test/seal";
import { NakafaAgentContentRefInputSchema } from "@repo/contents/agent/schema/read";
import { encodeJsonText } from "@repo/utilities/json";
import { MockLanguageModelV4 } from "ai/test";
import { Array as Arr, DateTime, Effect, Option } from "effect";

vi.mock("@repo/backend/confect/gateway/live", async () => ({
  GatewayLive: (await import("@repo/backend/test/gateway")).GatewayTest,
}));
vi.mock("@repo/backend/confect/nina/nakafa/agent", () => ({
  runNakafaAgent: vi.fn(),
}));

const fixture = () => createNinaTest({ prompt: "Explain a function limit." });

/** The cache marker as the request body carries it, from the language model profile. */
const CACHE_MARKER = `,"providerOptions":${encodeJsonText({ openaiCompatible: profile.cache.marker })}`;

const run = Ref.getFunctionReference(refs.internal.nina.response.run);
const pause = Ref.getFunctionReference(refs.public.nina.memory.pause);
const SUMMARY_UPDATED_AT = Date.UTC(2026, 8, 27, 12);

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.restoreAllMocks();
  deployment.mockReset();
  provider.languageModel.mockReset();
  vi.useRealTimers();
});

describe("Nina generation through the real Agent component", () => {
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
        provider.languageModel.mockReturnValue(
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
        );
        const f = yield* Effect.promise(() => fixture());
        yield* Effect.promise(() => f.t.action(run, { turnId: f.turnId }));
        const state = yield* Effect.promise(f.inspect);
        expect(state.turn?.state).toMatchObject({ status: "failed", reason });
        expect(state.user?.credits).toBe(10);
      })
  );

  it.effect("records the gateway cost a call reports on its usage row", () =>
    Effect.gen(function* () {
      provider.languageModel.mockReturnValue(
        new MockLanguageModelV4({
          doStream: ninaStream([
            { type: "stream-start", warnings: [] },
            { type: "text-start", id: "answer" },
            { type: "text-delta", id: "answer", delta: "A recorded answer." },
            { type: "text-end", id: "answer" },
            {
              type: "finish",
              finishReason: { unified: "stop", raw: "stop" },
              usage: ninaUsage,
              providerMetadata: { convexGateway: { cost: 0.25 } },
            },
          ]),
        })
      );
      const f = yield* Effect.promise(() => fixture());
      yield* Effect.promise(() => f.t.action(run, { turnId: f.turnId }));
      const state = yield* Effect.promise(f.inspect);
      expect(state.turn?.usage).toEqual([
        expect.objectContaining({ agent: "nina", calls: 1, cost: 0.25 }),
      ]);
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
      provider.languageModel.mockReturnValue(languageModel);
      const f = yield* Effect.promise(() => fixture());
      yield* Effect.promise(() => f.t.action(run, { turnId: f.turnId }));
      const state = yield* Effect.promise(f.inspect);
      expect(state.turn?.state.status).toBe("complete");
      expect(
        Option.getOrUndefined(
          Arr.findFirst(state.turn?.usage ?? [], (row) => row.agent === "nina")
        )
      ).toMatchObject({ input: 0, output: 0 });
    })
  );

  it.effect("retains the first stream failure through abort cleanup", () =>
    Effect.gen(function* () {
      provider.languageModel.mockReturnValue(ninaModel());
      vi.spyOn(Agent.prototype, "streamText").mockImplementationOnce(
        async (_ctx, _thread, options) => {
          await options.onError?.({ error: failures["rate-limit"] });
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
      provider.languageModel.mockReturnValue(ninaModel());
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
    provider.languageModel.mockReturnValue(languageModel);
    const f = await fixture();
    await f.t.action(run, { turnId: f.turnId });
    const state = await f.inspect();
    expect(state.turn?.state.status).toBe("complete");
    expect(state.turn?.suggestions).toBeUndefined();
    expect(Arr.map(state.turn?.usage ?? [], (row) => row.agent)).toEqual([
      "nina",
    ]);
    expect(state.chat?.activeTurnId).toBeUndefined();
    expect(languageModel.doGenerateCalls).toHaveLength(0);
    expect(state.user?.credits).toBe(5);
    expect(state.messages.page).toHaveLength(2);
    const answer = Option.getOrUndefined(
      Arr.findFirst(
        state.messages.page,
        (message) => message.role === "assistant"
      )
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
  });

  it("keeps progressive tool cards in permanent messages after the live stream ends", async () => {
    vi.useRealTimers();
    const languageModel = ninaModel(true);
    provider.languageModel.mockReturnValue(languageModel);
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
      Arr.filter(
        languageModel.doStreamCalls[1]?.prompt,
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
    const answer = Option.getOrUndefined(
      Arr.findFirst(
        state.messages.page,
        (message) => message.role === "assistant"
      )
    );
    expect(answer?.parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "tool-nakafa",
          state: "output-available",
          output: {
            // A run whose only card failed is stored as failed, whatever prose it returned.
            outcome: "failed",
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
    expect(
      Option.getOrUndefined(
        Arr.findFirst(state.turn?.usage ?? [], (row) => row.agent === "nina")
      )?.calls
    ).toBe(2);
  });

  it("refunds an interrupted provider without generating a title or follow-up", async () => {
    const languageModel = ninaModel(false, true);
    provider.languageModel.mockReturnValue(languageModel);
    const f = await fixture();
    await f.t.action(run, { turnId: f.turnId });
    const state = await f.inspect();
    expect(state.turn?.state.status).toBe("failed");
    expect(state.user?.credits).toBe(10);
    expect(
      Arr.filter(state.ledger, (row) => row.type === "refund")
    ).toHaveLength(1);
    expect(languageModel.doGenerateCalls).toHaveLength(0);
  });

  it("repairs invalid capability input through one accounted repair call", async () => {
    vi.useRealTimers();
    const languageModel = ninaModel(true, false, { request: 42 });
    provider.languageModel.mockReturnValue(languageModel);
    vi.mocked(runNakafaAgent).mockReturnValue(
      Effect.succeed({ text: "Repaired evidence" })
    );
    const f = await fixture();
    await f.t.action(run, { turnId: f.turnId });
    await f.t.finishAllScheduledFunctions(() => undefined);
    const state = await f.inspect();
    expect(state.turn?.state.status).toBe("complete");
    expect(runNakafaAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        task: expect.stringContaining(ninaToolInput.request),
      })
    );
    expect(encodeJsonText(languageModel.doGenerateCalls[0]?.prompt)).toContain(
      "Repair the arguments for nakafa"
    );
    expect(Arr.map(state.turn?.usage ?? [], (entry) => entry.agent)).toContain(
      "nina-repair"
    );
  });

  it("stores the claim and the readiness of a turn before its model is called, and the first signs of work after", async () => {
    // Only the wall clock is faked, so the model's call can take time at once.
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ["Date"] });
    const languageModel = ninaModel();
    const answer = languageModel.doStream;
    // The model takes five seconds to say anything.
    languageModel.doStream = (options) => {
      vi.advanceTimersByTime(5000);
      return answer.call(languageModel, options);
    };
    provider.languageModel.mockReturnValue(languageModel);
    const f = await fixture();
    // The run starts two seconds after the admission.
    const created = Math.ceil((await f.inspect()).turn?._creationTime ?? 0);
    vi.setSystemTime(created + 2000);
    await f.t.action(run, { turnId: f.turnId });

    const state = await f.inspect();
    expect(state.turn?.state.status).toBe("complete");
    const { claimedMs, readyMs, progressMs, tokenMs } =
      state.turn?.timing ?? {};
    // A model call that came first would carry its five seconds into both of
    // these stages.
    expect(claimedMs).toBeGreaterThanOrEqual(2000);
    expect(claimedMs).toBeLessThan(2001);
    expect(readyMs).toBe(claimedMs);
    // The reasoning, the answer text and the model's first word come with it.
    expect((progressMs ?? 0) - (readyMs ?? 0)).toBeCloseTo(5000, 2);
    expect(tokenMs).toBe(progressMs);
  });

  it("sends the rolling summary and omits the turns it covers", async () => {
    const languageModel = ninaModel();
    provider.languageModel.mockReturnValue(languageModel);
    const f = await createNinaTest({ history: 6 });
    await f.t.mutation(async (ctx) =>
      ctx.db.insert("ninaSummaries", {
        chatId: f.chatId,
        text: await sealedSummary(
          ctx,
          f.identity.userId,
          "- The learner practiced limits."
        ),
        throughOrder: 3,
        updatedAt: SUMMARY_UPDATED_AT,
        usage: { calls: 1, input: 900, output: 120 },
      })
    );
    await f.t.action(run, { turnId: f.turnId });
    const prompt = encodeJsonText(languageModel.doStreamCalls[0]?.prompt);
    expect(prompt).toContain("# Conversation Summary");
    expect(prompt).toContain("- The learner practiced limits.");
    expect(prompt).not.toContain("Earlier question 3");
    expect(prompt).toContain("Earlier question 4");
    expect(prompt).toContain("Earlier answer 5");
    // The settled turn keeps what the history of its prompt cost: orders 4 and 5.
    const turn = await f.t.query((ctx) => ctx.db.get("ninaTurns", f.turnId));
    expect(turn?.history).toEqual({ tokens: expect.any(Number), turns: 2 });
  });

  it("dates the prompt with the turn's creation time as an ISO string", async () => {
    const languageModel = ninaModel();
    provider.languageModel.mockReturnValue(languageModel);
    const f = await createNinaTest();
    await f.t.action(run, { turnId: f.turnId });
    const turn = await f.t.query((ctx) => ctx.db.get("ninaTurns", f.turnId));
    expect(encodeJsonText(languageModel.doStreamCalls[0]?.prompt)).toContain(
      `- date: ${DateTime.formatIso(DateTime.makeUnsafe(turn?._creationTime ?? 0))}`
    );
  });
});

describe("Nina generation with what the learner told her", () => {
  /** The system prompt, without the cache marker that moves, and the newest message of a model call. */
  function ends({ prompt }: { readonly prompt: readonly unknown[] }) {
    return {
      newest: encodeJsonText(Option.getOrUndefined(Arr.last(prompt))),
      system: encodeJsonText(
        Option.getOrUndefined(Arr.head(prompt))
      ).replaceAll(CACHE_MARKER, ""),
    };
  }

  it("keeps the system prompt byte for byte from one question to another, and gives each message the memories its words call up", async () => {
    const languageModel = ninaModelFor(2);
    provider.languageModel.mockReturnValue(languageModel);
    const f = await createPortraitTest();
    await f.seedPortrait({ text: "Duduk di kelas 12 dan suka contoh soal." });
    await f.seed({ confirmedAt: 1, text: "Bingung limit." });
    await f.seed({ confirmedAt: 2, text: "Suka main gitar." });
    await f.seed({ confirmedAt: 3, text: "Tinggal di Bandung." });
    await f.seed({ confirmedAt: 4, text: "Ikut SNBT 2027." });
    await f.seed({ confirmedAt: 5, text: "Kelas 12 IPA." });
    await f.t.action(run, { turnId: f.turnId });
    // A new memory and another question change the message, not the prompt.
    await f.seed({ confirmedAt: 6, text: "Mau kuliah di ITB." });
    const next = await appendNinaTurn(f, {
      prompt: "Bagaimana cara main gitar?",
    });
    await f.t.action(run, { turnId: next.turnId });
    const [one, two] = Arr.map(languageModel.doStreamCalls, ends);
    expect(two?.system).toBe(one?.system);
    expect(one?.system).toContain(
      "<portrait>\\nDuduk di kelas 12 dan suka contoh soal.\\n</portrait>"
    );
    expect(one?.system).not.toContain("Bingung limit.");
    expect(one?.newest).toContain("# Memories");
    expect(one?.newest).toContain("- Bingung limit. (1970-01-01)");
    expect(one?.newest).not.toContain("Suka main gitar.");
    expect(two?.newest).toContain("- Suka main gitar. (1970-01-01)");
    expect(two?.newest).not.toContain("Bingung limit.");
  });

  it.each([
    ["on", false, ["nakafa", "deepResearch", "math", "memory"]],
    ["paused", true, ["nakafa", "deepResearch", "math"]],
  ] as const)(
    "offers Nina the tools the registry and the policy allow while the learner's memory is %s",
    async (_state, paused, names) => {
      const languageModel = ninaModelFor(1);
      provider.languageModel.mockReturnValue(languageModel);
      const f = await createPortraitTest();
      if (paused) {
        await f.owner.mutation(pause, { paused: true });
      }
      await f.t.action(run, { turnId: f.turnId });
      expect(
        Arr.map(
          languageModel.doStreamCalls[0]?.tools ?? [],
          (tool) => tool.name
        )
      ).toEqual(names);
    }
  );
});
