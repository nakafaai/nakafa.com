import type { GatewayProvider } from "@ai-sdk/gateway";
import {
  ModelKey,
  models,
  thinking,
} from "@repo/backend/confect/gateway/model";
import {
  type Deadline,
  Purpose,
  purposes,
} from "@repo/backend/confect/gateway/purpose";
import { routing } from "@repo/backend/confect/gateway/route";
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
     * A language model ready for one purpose. Defaults are its outermost
     * middleware and routing its innermost, so call options may override
     * reasoning but never the route; call sites pass `timeout` unchanged.
     */
    readonly language: (request: LanguageRequest) => {
      readonly model: ReturnType<typeof wrapLanguageModel>;
      readonly timeout: Deadline;
    };
  }
>()("@repo/backend/gateway/Gateway") {}

/**
 * Builds every handle over one AI SDK provider, so both adapters route the
 * same way: the Vercel AI Gateway in production (`gateway/live.ts`) and
 * deterministic models in tests.
 */
export function make(
  provider: Pick<GatewayProvider, "languageModel">
): Gateway["Service"] {
  return Gateway.of({
    language: ({ model, purpose, space }) => {
      const { effort, timeout } = purposes[purpose];
      return {
        model: wrapLanguageModel({
          model: provider.languageModel(models[model]),
          middleware: [
            defaultSettingsMiddleware({
              settings: { providerOptions: { google: thinking[effort] } },
            }),
            routing(purpose, space),
          ],
        }),
        timeout,
      };
    },
  });
}
