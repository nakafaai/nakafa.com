import { describe, expect, it } from "@effect/vitest";
import { make } from "@repo/backend/confect/gateway/handle";
import { ModelKey } from "@repo/backend/confect/gateway/model";
import { Purpose } from "@repo/backend/confect/gateway/purpose";
import { Space } from "@repo/backend/confect/space";
import { MockLanguageModelV4 } from "ai/test";
import { Array as Arr, Effect, Schema } from "effect";

const personal = Schema.decodeUnknownSync(Space)({
  kind: "personal",
  userId: "user-1",
});
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
/** The Convex gateway model each key runs. */
const gatewayModels = {
  "nakafa-lite": "google/gemini-3.5-flash-lite",
  "nakafa-pro": "google/gemini-3.7-flash",
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
  it.effect.each(Arr.cartesian(Purpose.literals, ModelKey.literals))(
    "gives %s on %s its gateway model, reasoning, and deadlines",
    ([purpose, key]) =>
      Effect.gen(function* () {
        const { gateway, languageModel, model } = serve();
        const handle = gateway.language({
          purpose,
          model: key,
          space: personal,
        });
        yield* Effect.promise(() => handle.model.doGenerate({ prompt }));
        expect(languageModel).toHaveBeenCalledExactlyOnceWith(
          gatewayModels[key]
        );
        expect(handle.timeout).toEqual(deadlines[purpose]);
        expect(model.doGenerateCalls[0]?.providerOptions).toEqual({
          convexGateway: { reasoningEffort: reasoning[purpose] },
        });
      })
  );

  it.effect("lets a call option override the default reasoning", () =>
    Effect.gen(function* () {
      const { gateway, model } = serve();
      const handle = gateway.language({
        purpose: "chat",
        model: "nakafa-pro",
        space: personal,
      });
      yield* Effect.promise(() =>
        handle.model.doGenerate({
          prompt,
          providerOptions: { convexGateway: { reasoningEffort: "minimal" } },
        })
      );
      expect(model.doGenerateCalls[0]?.providerOptions).toEqual({
        convexGateway: { reasoningEffort: "minimal" },
      });
    })
  );

  it("keeps the served model's identity for usage accounting", () => {
    const { gateway, model } = serve();
    const handle = gateway.language({
      purpose: "background",
      model: "nakafa-lite",
      space: personal,
    });
    expect(handle.model.provider).toBe(model.provider);
    expect(handle.model.modelId).toBe(model.modelId);
  });
});
