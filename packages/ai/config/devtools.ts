import { DevToolsTelemetry } from "@ai-sdk/devtools";
import { gateway } from "@repo/ai/config/provider";
import { devtoolsKeys } from "@repo/ai/keys";
import { registerTelemetry } from "ai";

declare global {
  var NAKAFA_AI_SDK_DEVTOOLS_REGISTERED: true | undefined;
}

/** Enables AI SDK DevTools only for local development workflows. */
function shouldUseDevToolsTelemetry() {
  const env = devtoolsKeys();

  if (env.AI_SDK_DEVTOOLS !== "true") {
    return false;
  }

  // AI SDK DevTools throws in production mode and stores prompts, outputs,
  // and tool data locally in `.devtools/generations.json`.
  // Reference: https://ai-sdk.dev/v7/docs/ai-sdk-core/devtools
  if (env.NODE_ENV === "production") {
    return false;
  }

  return env.VERCEL_ENV === undefined || env.VERCEL_ENV === "development";
}

/**
 * Registers AI SDK v7 DevTools telemetry once for local app runtimes.
 *
 * DevTools stores prompts, outputs, and tool data in a local `.devtools`
 * directory, so production and Vercel preview/runtime environments never
 * register this telemetry integration.
 */
export function registerAiSdkDevToolsTelemetry() {
  if (!shouldUseDevToolsTelemetry()) {
    return;
  }

  if (globalThis.NAKAFA_AI_SDK_DEVTOOLS_REGISTERED) {
    return;
  }

  registerTelemetry(DevToolsTelemetry());
  globalThis.NAKAFA_AI_SDK_DEVTOOLS_REGISTERED = true;
}

/**
 * Creates the Gateway-backed language model used by interactive app routes.
 *
 * AI SDK DevTools stays in this app-facing module so Convex can import the
 * plain Gateway provider without pulling Node-only DevTools code.
 */
export function createAppLanguageModel(
  modelId: Parameters<typeof gateway>[number]
) {
  registerAiSdkDevToolsTelemetry();

  return gateway(modelId);
}
