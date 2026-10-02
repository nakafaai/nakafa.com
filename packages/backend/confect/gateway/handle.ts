import type { GatewayModelId } from "@ai-sdk/gateway";
import { type ModelKey, models } from "@repo/backend/confect/gateway/model";
import { type Purpose, purposes } from "@repo/backend/confect/gateway/purpose";
import { routing } from "@repo/backend/confect/gateway/route";
import type { Space } from "@repo/backend/confect/space";
import { defaultSettingsMiddleware, wrapLanguageModel } from "ai";
import { Context } from "effect";

/**
 * The AI SDK provider behind every handle: the Vercel AI Gateway in
 * production (`gateway/live.ts`), deterministic models in tests.
 */
export interface Provider {
  readonly languageModel: (
    id: GatewayModelId
  ) => Parameters<typeof wrapLanguageModel>[0]["model"];
}

/** What one model call is for, which model it runs, and whose data it carries. */
export interface LanguageRequest {
  readonly model: ModelKey;
  readonly purpose: Purpose;
  readonly space: Space;
}

/**
 * A language model ready for one purpose. Defaults are its outermost
 * middleware and routing its innermost, so call options may override
 * reasoning but never the route; call sites pass `timeout` unchanged.
 */
export interface LanguageHandle {
  readonly model: ReturnType<typeof wrapLanguageModel>;
  readonly timeout: (typeof purposes)[Purpose]["timeout"];
}

/** The one way Nakafa reaches a model. */
export class Gateway extends Context.Service<
  Gateway,
  { readonly language: (request: LanguageRequest) => LanguageHandle }
>()("@repo/backend/gateway/Gateway") {}

/** Builds every handle over one provider, so both adapters route the same way. */
export function make(provider: Provider): Gateway["Service"] {
  return Gateway.of({
    language: (request) => {
      const { effort, timeout } = purposes[request.purpose];
      const model = models[request.model];
      return {
        model: wrapLanguageModel({
          model: provider.languageModel(model.gateway),
          middleware: [
            defaultSettingsMiddleware({
              settings: { providerOptions: { google: model.options[effort] } },
            }),
            routing(request),
          ],
        }),
        timeout,
      };
    },
  });
}
