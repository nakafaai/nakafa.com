import { createGateway } from "@ai-sdk/gateway";
import { keys } from "@repo/ai/keys";

/**
 * Plain AI Gateway provider configuration shared by server runtimes.
 *
 * This module intentionally has no DevTools import: `@ai-sdk/devtools` uses
 * Node built-ins at module load time, while Convex actions should stay in the
 * default runtime unless a provider genuinely requires Node APIs.
 */
export const gateway = createGateway({
  apiKey: keys().AI_GATEWAY_API_KEY,
  headers: {
    "http-referer": "https://nakafa.com",
    "x-title": "nakafa.com",
  },
});
