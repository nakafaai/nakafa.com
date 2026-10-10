import { describe, expect, it } from "@effect/vitest";
import { make } from "@repo/backend/confect/gateway/handle";
import { Purpose } from "@repo/backend/confect/gateway/purpose";
import { MockLanguageModelV4 } from "ai/test";
import { Effect } from "effect";

const prompt = [
  { role: "user" as const, content: [{ type: "text" as const, text: "Hi" }] },
];
const answer = {
  content: [{ type: "text" as const, text: "Hello" }],
  finishReason: { unified: "stop" as const, raw: "stop" },
  usage: {
    inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 1, text: 1, reasoning: 0 },
  },
  warnings: [],
};
/** Chat reasons deeply; every supporting purpose reasons briefly. */
const reasoning = {
  chat: "high",
  specialist: "low",
  background: "low",
  suggestion: "low",
  presentation: "low",
};
/** Today's deadlines for every purpose. */
const deadlines = {
  chat: { chunkMs: 45_000, stepMs: 90_000, totalMs: 420_000 },
  specialist: { stepMs: 30_000, totalMs: 120_000 },
  background: { stepMs: 15_000, totalMs: 45_000 },
  suggestion: { stepMs: 30_000, totalMs: 90_000 },
  presentation: { stepMs: 15_000, totalMs: 45_000 },
};

/** A gateway over one recording model. */
function serve() {
  const model = new MockLanguageModelV4({
    doGenerate: answer,
    doStream: { stream: new ReadableStream() },
  });
  const languageModel = vi.fn<Parameters<typeof make>[0]["languageModel"]>(
    () => model
  );
  return { gateway: make({ languageModel }), languageModel, model };
}

describe("Gateway handles", () => {
  it.effect.each(Purpose.literals)(
    "gives %s the gateway model, reasoning, and deadlines",
    (purpose) =>
      Effect.gen(function* () {
        const { gateway, languageModel, model } = serve();
        const handle = gateway.language(purpose);
        yield* Effect.promise(() => handle.model.doGenerate({ prompt }));
        expect(languageModel).toHaveBeenCalledExactlyOnceWith(
          "google/gemini-3.8-flash"
        );
        expect(handle.timeout).toEqual(deadlines[purpose]);
        expect(model.doGenerateCalls[0]?.providerOptions).toEqual({
          convexGateway: {
            provider: { data_collection: "deny", zdr: true },
            reasoningEffort: reasoning[purpose],
          },
        });
      })
  );

  it.effect(
    "marks the cached prefix and asks for zero retention on every call",
    () =>
      Effect.gen(function* () {
        const { gateway, model } = serve();
        yield* Effect.promise(() =>
          gateway.language("chat").model.doGenerate({
            prompt: [
              { role: "system", content: "Static instructions." },
              ...prompt,
            ],
          })
        );
        expect(model.doGenerateCalls[0]?.prompt[0]).toEqual({
          role: "system",
          content: "Static instructions.",
          providerOptions: {
            openaiCompatible: { cache_control: { type: "ephemeral" } },
          },
        });
        expect(model.doGenerateCalls[0]?.providerOptions).toMatchObject({
          convexGateway: { provider: { data_collection: "deny", zdr: true } },
        });
      })
  );

  it.effect("lets a call option override the default reasoning", () =>
    Effect.gen(function* () {
      const { gateway, model } = serve();
      const handle = gateway.language("chat");
      yield* Effect.promise(() =>
        handle.model.doGenerate({
          prompt,
          providerOptions: { convexGateway: { reasoningEffort: "minimal" } },
        })
      );
      expect(model.doGenerateCalls[0]?.providerOptions).toEqual({
        convexGateway: {
          provider: { data_collection: "deny", zdr: true },
          reasoningEffort: "minimal",
        },
      });
    })
  );

  it("keeps the served model's identity for usage accounting", () => {
    const { gateway, model } = serve();
    const handle = gateway.language("background");
    expect(handle.model.provider).toBe(model.provider);
    expect(handle.model.modelId).toBe(model.modelId);
  });
});
