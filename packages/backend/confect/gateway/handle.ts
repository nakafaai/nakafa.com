import { cachedPrefix } from "@repo/backend/confect/gateway/cache";
import { classify } from "@repo/backend/confect/gateway/classify";
import {
  type Answers,
  type DecisionModel,
  decideWith,
  type Question,
  type State,
} from "@repo/backend/confect/gateway/decide";
import { escrowed } from "@repo/backend/confect/gateway/escrow";
import { GatewayFailure } from "@repo/backend/confect/gateway/failure";
import {
  decisionModelId,
  type EmbeddingModelId,
  embeddingDimensions,
  embeddingModelId,
  embeddingTimeoutMs,
  languageModel,
} from "@repo/backend/confect/gateway/model";
import {
  type Deadline,
  type Purpose,
  purposes,
} from "@repo/backend/confect/gateway/purpose";
import { Meter, metered } from "@repo/backend/confect/spend/meter";
import {
  decisionCost,
  embeddingCost,
  tokenBound,
} from "@repo/backend/confect/spend/rates";
import { defaultSettingsMiddleware, embedMany, wrapLanguageModel } from "ai";
import { Array as Arr, Context, Duration, Effect } from "effect";

/** The one way Nakafa reaches a model. */
export class Gateway extends Context.Service<
  Gateway,
  {
    /**
     * A language model ready for one purpose: zero retention, a cached prompt
     * prefix, and the purpose's output cap on every call. Its reasoning and
     * output defaults are its outermost middleware, so a call may override
     * them; call sites pass `timeout` unchanged.
     */
    readonly language: (purpose: Purpose) => {
      readonly model: ReturnType<typeof wrapLanguageModel>;
      readonly timeout: Deadline;
    };
    /**
     * Answers typed questions about one state with the decision model, in one
     * request with zero retention. The answers are typed by the questions. The
     * call retries a transient failure, ends at its deadline, and fails with a
     * `GatewayFailure` that `classify` reads like a failed language call.
     */
    readonly decide: <const Questions extends Record<string, Question>>(
      state: State,
      questions: Questions
    ) => Effect.Effect<Answers<Questions>, GatewayFailure>;
    /**
     * One vector per text, in order, each of `embeddingDimensions` numbers,
     * from the embedding model of knowledge search or from the candidate the
     * model test names. The request asks for zero retention with `zdr`, the
     * one retention flag the provider's embedding options hold (see
     * `retention` below). Callers embed published lessons and Quran text, and the
     * short search phrase that the specialist writes from a question, never a
     * stored learner message.
     */
    readonly embed: (
      texts: readonly string[],
      model?: EmbeddingModelId
    ) => Effect.Effect<readonly (readonly number[])[], GatewayFailure>;
  }
>()("@repo/backend/confect/gateway/handle/Gateway") {}

/**
 * Sent with every language model call: route only to an endpoint that keeps no
 * prompt and no answer, and refuse one that collects them. The gateway states
 * zero data retention itself; these flags make each request ask for it. A
 * decision and an embedding ask with `zdr` alone, the only flag the provider's
 * decision and embedding models send: the provider adds it to the body of the
 * request (`gatewayModelFetch` in `@convex-dev/ai-sdk-provider`).
 */
const retention = { data_collection: "deny", zdr: true };

/** How many times a decision is asked at most: its first ask and the retries of `decideWith`. */
const DECISION_ASKS = 3;

/** The language model every provider hands to the AI SDK. */
type ProviderLanguageModel = Parameters<typeof wrapLanguageModel>[0]["model"];

/** The embedding model every provider hands to the AI SDK. */
type EmbeddingModel = Parameters<typeof embedMany>[0]["model"];

/**
 * Builds every handle over one AI SDK provider, so the production adapter
 * (`gateway/live.ts`) and deterministic models in tests set the same defaults.
 * The provider makes both kinds of model: the language model of a purpose, and
 * the decision model, which it makes with the zero retention request. Every
 * call goes through `meter`: it holds the call's ceiling before the provider
 * is asked and settles to what the call cost (`confect/spend`).
 */
export function make(
  provider: {
    readonly decisionModel: (
      modelId: string,
      options: { readonly zdr: boolean }
    ) => DecisionModel;
    readonly languageModel: (modelId: string) => ProviderLanguageModel;
    readonly embeddingModel: (
      modelId: string,
      options: { readonly zdr: boolean }
    ) => EmbeddingModel;
  },
  meter: Meter["Service"]
): Gateway["Service"] {
  // A refused hold reads as the payer's exhausted quota, as `classify` reads it
  // for a language call.
  const metering = <A, E>(effect: Effect.Effect<A, E, Meter>) =>
    Effect.provideService(effect, Meter, meter).pipe(
      Effect.catchTag("SpendRefused", () =>
        Effect.fail(new GatewayFailure({ reason: "quota" }))
      )
    );
  return Gateway.of({
    decide: (state, questions) => {
      // The request's text bounds its tokens, and each ask may be billed.
      const held =
        decisionCost(tokenBound(JSON.stringify({ questions, state }))) *
        DECISION_ASKS;
      return metering(
        metered(
          "decision",
          held,
          decideWith(
            provider.decisionModel(decisionModelId, { zdr: retention.zdr }),
            state,
            questions
          ),
          ({ input }) => (input === undefined ? held : decisionCost(input))
        )
      ).pipe(Effect.map(({ answers }) => answers));
    },
    language: (purpose) => {
      const { effort, timeout } = purposes[purpose];
      return {
        model: wrapLanguageModel({
          model: provider.languageModel(languageModel.id),
          middleware: [
            defaultSettingsMiddleware({
              settings: {
                maxOutputTokens: languageModel.output[purpose],
                providerOptions: {
                  convexGateway: {
                    provider: retention,
                    reasoningEffort: languageModel.reasoning[effort],
                  },
                },
              },
            }),
            cachedPrefix,
            escrowed(meter, purpose),
          ],
        }),
        timeout,
      };
    },
    embed: Effect.fn("gateway.embed")(function* (
      texts: readonly string[],
      model: EmbeddingModelId = embeddingModelId
    ) {
      // The texts bound their tokens, and the reply reports what they were.
      const held = embeddingCost(
        Arr.reduce(texts, 0, (total, text) => total + tokenBound(text))
      );
      const { embeddings } = yield* metering(
        metered(
          "embedding",
          held,
          Effect.tryPromise({
            try: (signal) =>
              embedMany({
                abortSignal: signal,
                model: provider.embeddingModel(model, { zdr: retention.zdr }),
                providerOptions: {
                  openaiCompatible: { dimensions: embeddingDimensions },
                },
                values: Arr.fromIterable(texts),
              }),
            catch: classify,
          }).pipe(
            Effect.timeoutOrElse({
              duration: Duration.millis(embeddingTimeoutMs),
              orElse: () =>
                Effect.fail(new GatewayFailure({ reason: "timeout" })),
            })
          ),
          ({ usage }) => embeddingCost(usage.tokens)
        )
      );
      // A reply that does not match the request is not a vector the index
      // can hold.
      if (
        embeddings.length !== texts.length ||
        Arr.some(
          embeddings,
          (embedding) => embedding.length !== embeddingDimensions
        )
      ) {
        return yield* new GatewayFailure({ reason: "unknown" });
      }
      return embeddings;
    }),
  });
}
