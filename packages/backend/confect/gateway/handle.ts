import { cachedPrefix } from "@repo/backend/confect/gateway/cache";
import {
  classify,
  GatewayFailure,
} from "@repo/backend/confect/gateway/failure";
import {
  type EmbeddingModelId,
  embeddingDimensions,
  embeddingModelId,
  embeddingTimeoutMs,
  languageModelId,
  reasoning,
} from "@repo/backend/confect/gateway/model";
import {
  type Deadline,
  type Purpose,
  purposes,
} from "@repo/backend/confect/gateway/purpose";
import {
  defaultSettingsMiddleware,
  embedMany,
  wrapLanguageModel,
} from "ai";
import { Array as Arr, Context, Duration, Effect } from "effect";

/** The one way Nakafa reaches a model. */
export class Gateway extends Context.Service<
  Gateway,
  {
    /**
     * A language model ready for one purpose: zero retention and a cached
     * prompt prefix on every call. Its reasoning defaults are its outermost
     * middleware, so a call may override them; call sites pass `timeout`
     * unchanged.
     */
    readonly language: (purpose: Purpose) => {
      readonly model: ReturnType<typeof wrapLanguageModel>;
      readonly timeout: Deadline;
    };
    /**
     * One vector per text, in order, each of `embeddingDimensions` numbers,
     * from the embedding model of knowledge search or from the candidate the
     * model test names. The request carries no retention flags, because the AI
     * SDK sends an embedding request only the model, the texts, and the vector
     * length. Callers embed published lessons and Quran text, and the short
     * search phrase a model wrote, never a stored learner message.
     */
    readonly embed: (
      texts: readonly string[],
      model?: EmbeddingModelId
    ) => Effect.Effect<ReadonlyArray<ReadonlyArray<number>>, GatewayFailure>;
  }
>()("@repo/backend/confect/gateway/handle/Gateway") {}

/**
 * Sent with every call: route only to an endpoint that keeps no prompt and no
 * answer, and refuse one that collects them. The gateway states zero data
 * retention itself; these flags make each request ask for it.
 */
const retention = { data_collection: "deny", zdr: true };

/** The language model every provider hands to the AI SDK. */
type LanguageModel = Parameters<typeof wrapLanguageModel>[0]["model"];

/** The embedding model every provider hands to the AI SDK. */
type EmbeddingModel = Parameters<typeof embedMany>[0]["model"];

/**
 * Builds every handle over one AI SDK provider, so the production adapter
 * (`gateway/live.ts`) and deterministic models in tests set the same defaults.
 */
export function make(provider: {
  readonly languageModel: (modelId: string) => LanguageModel;
  readonly embeddingModel: (modelId: string) => EmbeddingModel;
}): Gateway["Service"] {
  return Gateway.of({
    language: (purpose) => {
      const { effort, timeout } = purposes[purpose];
      return {
        model: wrapLanguageModel({
          model: provider.languageModel(languageModelId),
          middleware: [
            defaultSettingsMiddleware({
              settings: {
                providerOptions: {
                  convexGateway: {
                    provider: retention,
                    reasoningEffort: reasoning[effort],
                  },
                },
              },
            }),
            cachedPrefix,
          ],
        }),
        timeout,
      };
    },
    embed: Effect.fn("gateway.embed")(function* (
      texts: readonly string[],
      model: EmbeddingModelId = embeddingModelId
    ) {
      const { embeddings } = yield* Effect.tryPromise({
        try: (signal) =>
          embedMany({
            abortSignal: signal,
            model: provider.embeddingModel(model),
            providerOptions: {
              openaiCompatible: { dimensions: embeddingDimensions },
            },
            values: Arr.fromIterable(texts),
          }),
        catch: classify,
      }).pipe(
        Effect.timeoutOrElse({
          duration: Duration.millis(embeddingTimeoutMs),
          orElse: () => Effect.fail(new GatewayFailure({ reason: "timeout" })),
        })
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
