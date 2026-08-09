import { DevToolsTelemetry } from "@ai-sdk/devtools";
import { isAiSdkDevToolsTelemetryEnabled } from "@repo/ai/config/devtools-runtime";
import { gateway } from "@repo/ai/config/provider";
import { registerTelemetry } from "ai";

declare global {
  var NAKAFA_AI_SDK_DEVTOOLS_REGISTERED: true | undefined;
}

/**
 * Registers AI SDK v7 DevTools telemetry once for local app runtimes.
 *
 * DevTools stores prompts, outputs, and tool data in a local `.devtools`
 * directory, so production and Vercel preview/runtime environments never
 * register this telemetry integration.
 */
export function registerAiSdkDevToolsTelemetry() {
  if (!isAiSdkDevToolsTelemetryEnabled()) {
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
