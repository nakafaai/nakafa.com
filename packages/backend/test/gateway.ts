import type { GatewayConfigurationError } from "@repo/backend/confect/gateway/failure";
import { GatewayFailure } from "@repo/backend/confect/gateway/failure";
import { Gateway, make } from "@repo/backend/confect/gateway/handle";
import { embeddingDimensions } from "@repo/backend/confect/gateway/model";
import {
  Experimental_DecisionMockModelV4 as DecisionMockModel,
  MockEmbeddingModelV4,
} from "ai/test";
import {
  Array as Arr,
  Effect,
  Layer,
  MutableRef,
  Option,
  Record as Rec,
  String as Str,
} from "effect";

const WORD = /\p{L}+/gu;

/**
 * A deterministic embedding model for tests. Each group of words stands for one
 * meaning in several languages and owns one coordinate of the vector, and the
 * vector of a text counts the words that it holds from each group, so two texts
 * about one meaning are close whatever their language. `doEmbedCalls` of the
 * returned model lists the texts that were embedded.
 */
export function conceptEmbedder(concepts: readonly (readonly string[])[]) {
  const vectorOf = (text: string) => {
    const words = Arr.map(
      Arr.fromIterable(text.toLowerCase().matchAll(WORD)),
      ([word]) => word
    );
    return Arr.makeBy(embeddingDimensions, (coordinate) =>
      Option.match(Arr.get(concepts, coordinate), {
        onNone: () => 0,
        onSome: (group) =>
          Arr.length(Arr.filter(words, (word) => Arr.contains(group, word))),
      })
    );
  };
  return new MockEmbeddingModelV4({
    doEmbed: ({ values }) =>
      Promise.resolve({ embeddings: Arr.map(values, vectorOf), warnings: [] }),
    maxEmbeddingsPerCall: 512,
  });
}

/**
 * The deterministic provider behind the test adapter; each test programs its
 * language model, its decision model and its embedding model.
 */
export const provider = {
  decisionModel: vi.fn<Parameters<typeof make>[0]["decisionModel"]>(),
  embeddingModel: vi.fn<Parameters<typeof make>[0]["embeddingModel"]>(),
  languageModel: vi.fn<Parameters<typeof make>[0]["languageModel"]>(),
};

/**
 * What the deployment's gateway check finds before the test adapter is built;
 * tests program an unavailable deployment with a GatewayConfigurationError.
 */
export const deployment = vi.fn<
  () => Effect.Effect<void, GatewayConfigurationError>
>(() => Effect.void);

/**
 * The test adapter: production handles (defaults and deadlines) over
 * `provider`, behind the programmable deployment check. Confect functions under
 * test get it by mocking `confect/gateway/live` with it.
 */
export const GatewayTest = Layer.effect(
  Gateway,
  Effect.as(Effect.suspend(deployment), make(provider))
);

/**
 * A deterministic decision model, handed out by `provider` for every decision.
 * It answers each yes-or-no question with the probability `probabilityOf` gives
 * for the judgment the question asks (`lasting`) and the position of the text
 * the question is about (0 for the first), and it records every request it
 * receives.
 */
export function decides(
  probabilityOf: (judgment: string, index: number) => number
) {
  const requests = MutableRef.make<
    readonly Parameters<DecisionMockModel["doDecide"]>[0][]
  >([]);
  const model = new DecisionMockModel({
    doDecide: (request) => {
      MutableRef.update(requests, Arr.append(request));
      return Promise.resolve({
        answers: Rec.map(request.questions, (_, id) => {
          const [judgment, position] = Str.split(id, ".");
          return {
            probability: probabilityOf(judgment, Number(position)),
            type: "boolean" as const,
          };
        }),
        warnings: [],
      });
    },
  });
  provider.decisionModel.mockReturnValue(model);
  return { model, requests: () => MutableRef.get(requests) };
}

/**
 * One failure per reason, with the routing facts the classifier keeps. The
 * gateway documents a type only for some bodies, such as the `provider`
 * rejection, whose type is `invalid_request_error`, so the other fixtures
 * carry none.
 */
export const failures = {
  "rate-limit": new GatewayFailure({
    reason: "rate-limit",
    status: 429,
    retryAfter: 2,
    retryable: true,
  }),
  quota: new GatewayFailure({
    reason: "quota",
    status: 402,
    retryable: false,
  }),
  auth: new GatewayFailure({
    reason: "auth",
    status: 401,
    retryable: false,
  }),
  configuration: new GatewayFailure({
    reason: "configuration",
    status: 404,
    retryable: false,
  }),
  invalid: new GatewayFailure({
    reason: "invalid",
    status: 400,
    retryable: false,
    type: "invalid_request_error",
  }),
  "too-large": new GatewayFailure({
    reason: "too-large",
    status: 413,
    retryable: false,
  }),
  timeout: new GatewayFailure({
    reason: "timeout",
    status: 408,
    retryable: true,
  }),
  unavailable: new GatewayFailure({
    reason: "unavailable",
    status: 503,
    retryable: true,
  }),
  network: new GatewayFailure({ reason: "network", retryable: true }),
  interrupted: new GatewayFailure({ reason: "interrupted" }),
  unknown: new GatewayFailure({ reason: "unknown" }),
} satisfies Record<GatewayFailure["reason"], GatewayFailure>;
