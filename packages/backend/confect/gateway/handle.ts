import { cachedPrefix } from "@repo/backend/confect/gateway/cache";
import {
  languageModelId,
  reasoning,
} from "@repo/backend/confect/gateway/model";
import {
  type Deadline,
  type Purpose,
  purposes,
} from "@repo/backend/confect/gateway/purpose";
import { defaultSettingsMiddleware, wrapLanguageModel } from "ai";
import { Context } from "effect";

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

/**
 * Builds every handle over one AI SDK provider, so the production adapter
 * (`gateway/live.ts`) and deterministic models in tests set the same defaults.
 */
export function make(provider: {
  readonly languageModel: (modelId: string) => LanguageModel;
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
  });
}
