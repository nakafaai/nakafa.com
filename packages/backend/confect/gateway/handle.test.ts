import { describe, expect, it } from "@effect/vitest";
import { make } from "@repo/backend/confect/gateway/handle";
import { Purpose } from "@repo/backend/confect/gateway/purpose";
import { APICallError } from "ai";
import { MockEmbeddingModelV4, MockLanguageModelV4 } from "ai/test";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";

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
/** The length every stored vector has. */
const DIMENSIONS = 768;

/** One vector of the index length whose first number tells it apart. */
function vector(first: number) {
  return Arr.makeBy(DIMENSIONS, (index) => (index === 0 ? first : 0));
}

/** A gateway over one recording language model and one embedding model. */
function serve(doEmbed?: MockEmbeddingModelV4["doEmbed"]) {
  const model = new MockLanguageModelV4({
    doGenerate: answer,
    doStream: { stream: new ReadableStream() },
  });
  const embedder = new MockEmbeddingModelV4({
    doEmbed:
      doEmbed ??
      (({ values }) =>
        Promise.resolve({
          embeddings: Arr.map(values, (_, index) => vector(index)),
          warnings: [],
        })),
    // The Convex AI gateway takes up to 512 texts in one request.
    maxEmbeddingsPerCall: 512,
  });
  const languageModel = vi.fn<Parameters<typeof make>[0]["languageModel"]>(
    () => model
  );
  const embeddingModel = vi.fn<Parameters<typeof make>[0]["embeddingModel"]>(
    () => embedder
  );
  return {
    embedder,
    embeddingModel,
    gateway: make({ embeddingModel, languageModel }),
    languageModel,
    model,
  };
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

describe("Gateway embeddings", () => {
  it.effect("embeds each text at the vector length of the index", () =>
    Effect.gen(function* () {
      const { embedder, embeddingModel, gateway } = serve();
      const embeddings = yield* gateway.embed(["first", "second"]);
      expect(embeddingModel).toHaveBeenCalledExactlyOnceWith(
        "google/gemini-embedding-2"
      );
      expect(embeddings).toEqual([vector(0), vector(1)]);
      expect(embedder.doEmbedCalls[0]).toMatchObject({
        providerOptions: { openaiCompatible: { dimensions: DIMENSIONS } },
        values: ["first", "second"],
      });
    })
  );

  it.effect("embeds with the candidate model a caller names", () =>
    Effect.gen(function* () {
      const { embeddingModel, gateway } = serve();
      yield* gateway.embed(["first"], "qwen/qwen3-embedding-8b");
      expect(embeddingModel).toHaveBeenCalledExactlyOnceWith(
        "qwen/qwen3-embedding-8b"
      );
    })
  );

  it.effect("classifies a rejected request by its status", () =>
    Effect.gen(function* () {
      const { gateway } = serve(() =>
        Promise.reject(
          new APICallError({
            message: "private provider response",
            requestBodyValues: { input: "private text" },
            statusCode: 400,
            url: "https://provider.example.invalid",
          })
        )
      );
      const failure = yield* Effect.flip(gateway.embed(["first"]));
      expect(failure).toMatchObject({
        _tag: "GatewayFailure",
        reason: "invalid",
        status: 400,
      });
      expect(encodeJsonText(failure)).not.toContain("private");
    })
  );

  it.effect("classifies a model that cannot be built", () =>
    Effect.gen(function* () {
      const { embeddingModel, gateway } = serve();
      embeddingModel.mockImplementation(() => {
        throw new Error("no such model");
      });
      const failure = yield* Effect.flip(gateway.embed(["first"]));
      expect(failure).toMatchObject({ _tag: "GatewayFailure", reason: "unknown" });
    })
  );

  it.effect.each([
    ["fewer vectors than texts", () => [vector(0)]],
    ["a vector of another length", () => [vector(0), [1, 2, 3]]],
  ] as const)("rejects a reply with %s", ([, embeddings]) =>
    Effect.gen(function* () {
      const { gateway } = serve(() =>
        Promise.resolve({ embeddings: embeddings(), warnings: [] })
      );
      const failure = yield* Effect.flip(gateway.embed(["first", "second"]));
      expect(failure).toMatchObject({ _tag: "GatewayFailure", reason: "unknown" });
    })
  );

  it.effect("gives up on a call that never answers", () =>
    Effect.gen(function* () {
      const { gateway } = serve(() => new Promise(() => undefined));
      const fiber = yield* Effect.forkChild(
        Effect.flip(gateway.embed(["first"]))
      );
      yield* TestClock.adjust("30 seconds");
      expect(yield* Fiber.join(fiber)).toMatchObject({
        _tag: "GatewayFailure",
        reason: "timeout",
      });
    })
  );
});
