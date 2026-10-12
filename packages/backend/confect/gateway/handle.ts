import { cachedPrefix } from "@repo/backend/confect/gateway/cache";
import {
  type Answers,
  type DecisionModel,
  decideWith,
  type Question,
  type State,
} from "@repo/backend/confect/gateway/decide";
import type { GatewayFailure } from "@repo/backend/confect/gateway/failure";
import {
  decisionModelId,
  languageModelId,
  reasoning,
} from "@repo/backend/confect/gateway/model";
import {
  type Deadline,
  type Purpose,
  purposes,
} from "@repo/backend/confect/gateway/purpose";
import { defaultSettingsMiddleware, wrapLanguageModel } from "ai";
import { Context, type Effect } from "effect";

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
  }
>()("@repo/backend/confect/gateway/handle/Gateway") {}

/**
 * Sent with every call: route only to an endpoint that keeps no prompt and no
 * answer, and refuse one that collects them. The gateway states zero data
 * retention itself; these flags make each request ask for it. A decision asks
 * with `zdr` alone, the only flag the provider's decision model sends.
 */
const retention = { data_collection: "deny", zdr: true };

/** The language model every provider hands to the AI SDK. */
type LanguageModel = Parameters<typeof wrapLanguageModel>[0]["model"];

/**
 * Builds every handle over one AI SDK provider, so the production adapter
 * (`gateway/live.ts`) and deterministic models in tests set the same defaults.
 * The provider makes both kinds of model: the language model of a purpose, and
 * the decision model, which it makes with the zero retention request.
 */
export function make(provider: {
  readonly decisionModel: (
    modelId: string,
    options: { readonly zdr: boolean }
  ) => DecisionModel;
  readonly languageModel: (modelId: string) => LanguageModel;
}): Gateway["Service"] {
  return Gateway.of({
    decide: (state, questions) =>
      decideWith(
        provider.decisionModel(decisionModelId, { zdr: retention.zdr }),
        state,
        questions
      ),
    language: (purpose) => {
      const { effort, maxOutputTokens, timeout } = purposes[purpose];
      return {
        model: wrapLanguageModel({
          model: provider.languageModel(languageModelId),
          middleware: [
            defaultSettingsMiddleware({
              settings: {
                maxOutputTokens,
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
  });
}
