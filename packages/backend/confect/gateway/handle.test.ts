import { describe, expect, it } from "@effect/vitest";
import { make } from "@repo/backend/confect/gateway/handle";
import { languageModel as profile } from "@repo/backend/confect/gateway/model";
import { Purpose, purposes } from "@repo/backend/confect/gateway/purpose";
import {
  decisionCost,
  embeddingCost,
  tokenBound,
} from "@repo/backend/confect/spend/rates";
import { recordingMeter } from "@repo/backend/test/spend";
import { encodeJsonText } from "@repo/utilities/json";
import { APICallError } from "ai";
import {
  Experimental_DecisionMockModelV4 as DecisionMockModel,
  MockEmbeddingModelV4,
  MockLanguageModelV4,
} from "ai/test";
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
/** The reasoning effort the profile gives the effort of a purpose. */
function reasoningOf(purpose: Purpose) {
  return profile.reasoning[purposes[purpose].effort];
}
/** The length every stored vector has. */
const DIMENSIONS = 768;

/** One vector of the index length whose first number tells it apart. */
function vector(first: number) {
  return Arr.makeBy(DIMENSIONS, (index) => (index === 0 ? first : 0));
}

/** A gateway over one recording language model, one deterministic decision model, one embedding model and a recording meter. */
function serve(doEmbed?: MockEmbeddingModelV4["doEmbed"], refuse = false) {
  const meter = recordingMeter(refuse);
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
          usage: { tokens: 11 },
          warnings: [],
        })),
    // The Convex AI gateway takes up to 512 texts in one request.
    maxEmbeddingsPerCall: 512,
  });
  const languageModel = vi.fn<Parameters<typeof make>[0]["languageModel"]>(
    () => model
  );
  const decider = new DecisionMockModel({
    doDecide: () =>
      Promise.resolve({
        answers: { lasting: { type: "boolean", probability: 0.9 } },
        usage: { inputTokens: 1000, outputTokens: 0 },
        warnings: [],
      }),
  });
  const decisionModel = vi.fn<Parameters<typeof make>[0]["decisionModel"]>(
    () => decider
  );
  const embeddingModel = vi.fn<Parameters<typeof make>[0]["embeddingModel"]>(
    () => embedder
  );
  return {
    decisionModel,
    embedder,
    embeddingModel,
    gateway: make(
      { decisionModel, embeddingModel, languageModel },
      meter.service
    ),
    languageModel,
    meter,
    model,
  };
}

describe("Gateway handles", () => {
  it.effect.each(Purpose.literals)(
    "gives %s the gateway model, reasoning, output cap, and deadlines",
    (purpose) =>
      Effect.gen(function* () {
        const { gateway, languageModel, model } = serve();
        const handle = gateway.language(purpose);
        yield* Effect.promise(() => handle.model.doGenerate({ prompt }));
        expect(languageModel).toHaveBeenCalledExactlyOnceWith(profile.id);
        expect(handle.timeout).toEqual(purposes[purpose].timeout);
        expect(model.doGenerateCalls[0]?.maxOutputTokens).toBe(
          profile.output[purpose]
        );
        expect(model.doGenerateCalls[0]?.providerOptions).toEqual({
          convexGateway: {
            provider: { data_collection: "deny", zdr: true },
            reasoningEffort: reasoningOf(purpose),
          },
        });
      })
  );

  it.effect.each(Purpose.literals)(
    "caps a streamed %s answer at the same output limit",
    (purpose) =>
      Effect.gen(function* () {
        const { gateway, model } = serve();
        yield* Effect.promise(() =>
          gateway.language(purpose).model.doStream({ prompt })
        );
        expect(model.doStreamCalls[0]?.maxOutputTokens).toBe(
          profile.output[purpose]
        );
      })
  );

  it.effect("lets a call set its own, lower output limit", () =>
    Effect.gen(function* () {
      const { gateway, model } = serve();
      yield* Effect.promise(() =>
        gateway
          .language("chat")
          .model.doGenerate({ prompt, maxOutputTokens: 64 })
      );
      expect(model.doGenerateCalls[0]?.maxOutputTokens).toBe(64);
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

  it.effect(
    "asks the provider for the decision model with the zero retention request, and answers a decision with it",
    () =>
      Effect.gen(function* () {
        const { decisionModel, gateway } = serve();
        const answers = yield* gateway.decide("Kelas 12 IPA.", {
          lasting: { type: "boolean", instructions: "Does it last?" },
        });
        expect(decisionModel).toHaveBeenCalledExactlyOnceWith(
          "typesafe/jev-1.13",
          { zdr: true }
        );
        expect(answers).toEqual({
          lasting: { type: "boolean", probability: 0.9 },
        });
      })
  );

  it.effect(
    "holds a decision's text bound for each ask and settles to the tokens it read",
    () =>
      Effect.gen(function* () {
        const { gateway, meter } = serve();
        yield* gateway.decide("Kelas 12 IPA.", {
          lasting: { type: "boolean", instructions: "Does it last?" },
        });
        const request = encodeJsonText({
          questions: {
            lasting: { type: "boolean", instructions: "Does it last?" },
          },
          state: "Kelas 12 IPA.",
        });
        expect(meter.calls()).toEqual([
          `hold decision ${decisionCost(tokenBound(request)) * 3}`,
          `settle ${decisionCost(1000)}`,
        ]);
      })
  );

  it.effect("settles a decision with no reported tokens to its hold", () =>
    Effect.gen(function* () {
      const { decisionModel, gateway, meter } = serve();
      decisionModel.mockReturnValue(
        new DecisionMockModel({
          doDecide: () =>
            Promise.resolve({
              answers: { lasting: { type: "boolean", probability: 0.9 } },
              warnings: [],
            }),
        })
      );
      yield* gateway.decide("Kelas 12 IPA.", {
        lasting: { type: "boolean", instructions: "Does it last?" },
      });
      const [hold, settle] = meter.calls();
      expect(settle?.replace("settle", "hold decision")).toBe(hold);
    })
  );

  it.effect(
    "fails a refused decision or embedding as an exhausted quota, before any provider call",
    () =>
      Effect.gen(function* () {
        const { embedder, gateway } = serve(undefined, true);
        const decision = yield* Effect.flip(
          gateway.decide("Kelas 12 IPA.", {
            lasting: { type: "boolean", instructions: "Does it last?" },
          })
        );
        const embedding = yield* Effect.flip(gateway.embed(["first"]));
        expect(decision).toMatchObject({
          _tag: "GatewayFailure",
          reason: "quota",
        });
        expect(embedding).toMatchObject({
          _tag: "GatewayFailure",
          reason: "quota",
        });
        expect(embedder.doEmbedCalls).toEqual([]);
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
      const { embedder, embeddingModel, gateway, meter } = serve();
      const embeddings = yield* gateway.embed(["first", "second"]);
      // The request asks for zero retention, as a decision does.
      expect(embeddingModel).toHaveBeenCalledExactlyOnceWith(
        "google/gemini-embedding-2",
        { zdr: true }
      );
      expect(embeddings).toEqual([vector(0), vector(1)]);
      // "first" and "second" bound the hold at 11 tokens, and the reply reports 11.
      expect(meter.calls()).toEqual([
        `hold embedding ${embeddingCost(11)}`,
        `settle ${embeddingCost(11)}`,
      ]);
      expect(embedder.doEmbedCalls[0]).toMatchObject({
        providerOptions: { openaiCompatible: { dimensions: DIMENSIONS } },
        values: ["first", "second"],
      });
    })
  );

  it.effect(
    "settles an embedding whose reply reports no tokens to its hold",
    () =>
      Effect.gen(function* () {
        const { gateway, meter } = serve(({ values }) =>
          Promise.resolve({
            embeddings: Arr.map(values, (_, index) => vector(index)),
            warnings: [],
          })
        );
        yield* gateway.embed(["first"]);
        expect(meter.calls()).toEqual([
          `hold embedding ${embeddingCost(5)}`,
          `settle ${embeddingCost(5)}`,
        ]);
      })
  );

  it.effect("embeds with the candidate model a caller names", () =>
    Effect.gen(function* () {
      const { embeddingModel, gateway } = serve();
      yield* gateway.embed(["first"], "qwen/qwen3-embedding-8b");
      expect(embeddingModel).toHaveBeenCalledExactlyOnceWith(
        "qwen/qwen3-embedding-8b",
        { zdr: true }
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
      expect(failure).toMatchObject({
        _tag: "GatewayFailure",
        reason: "unknown",
      });
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
      expect(failure).toMatchObject({
        _tag: "GatewayFailure",
        reason: "unknown",
      });
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
