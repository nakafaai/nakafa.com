import { devToolsMiddleware } from "@ai-sdk/devtools";
import { gateway } from "@repo/ai/config/provider";
import { devtoolsKeys } from "@repo/ai/keys";
import { wrapLanguageModel } from "ai";

/** Enables AI SDK DevTools only for local development workflows. */
function shouldUseDevTools() {
  const env = devtoolsKeys();

  if (env.AI_SDK_DEVTOOLS !== "true") {
    return false;
  }

  // AI SDK DevTools throws in production mode and stores prompts, outputs,
  // and tool data locally in `.devtools/generations.json`.
  // Reference: https://ai-sdk.dev/docs/ai-sdk-core/devtools
  if (env.NODE_ENV === "production") {
    return false;
  }

  return env.VERCEL_ENV === undefined || env.VERCEL_ENV === "development";
}

/**
 * Creates the Gateway-backed language model used by interactive app routes.
 *
 * AI SDK DevTools stays in this app-facing module so Convex can import the
 * plain Gateway provider without pulling Node-only DevTools code.
 */
export function createWrappedLanguageModel(
  modelId: Parameters<typeof gateway>[number]
) {
  const languageModel = gateway(modelId);

  if (shouldUseDevTools()) {
    return wrapLanguageModel({
      model: languageModel,
      middleware: devToolsMiddleware(),
    });
  }

  return languageModel;
}
