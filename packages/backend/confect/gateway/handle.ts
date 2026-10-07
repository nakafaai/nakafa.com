import {
  ModelKey,
  models,
  reasoning,
} from "@repo/backend/confect/gateway/model";
import {
  type Deadline,
  Purpose,
  purposes,
} from "@repo/backend/confect/gateway/purpose";
import { Space } from "@repo/backend/confect/space";
import { defaultSettingsMiddleware, wrapLanguageModel } from "ai";
import { Context, Schema } from "effect";

/** What one model call is for, which model it runs, and whose data it carries. */
export const LanguageRequest = Schema.Struct({
  model: ModelKey,
  purpose: Purpose,
  space: Space,
});
export type LanguageRequest = typeof LanguageRequest.Type;

/** The one way Nakafa reaches a model. */
export class Gateway extends Context.Service<
  Gateway,
  {
    /**
     * A language model ready for one purpose. Its reasoning defaults are its
     * outermost middleware, so a call may override them; call sites pass
     * `timeout` unchanged.
     */
    readonly language: (request: LanguageRequest) => {
      readonly model: ReturnType<typeof wrapLanguageModel>;
      readonly timeout: Deadline;
    };
  }
>()("@repo/backend/gateway/Gateway") {}

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
    language: ({ model, purpose }) => {
      const { effort, timeout } = purposes[purpose];
      return {
        model: wrapLanguageModel({
          model: provider.languageModel(models[model]),
          middleware: defaultSettingsMiddleware({
            settings: {
              providerOptions: {
                convexGateway: { reasoningEffort: reasoning[effort] },
              },
            },
          }),
        }),
        timeout,
      };
    },
  });
}
