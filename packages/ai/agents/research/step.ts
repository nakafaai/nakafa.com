import type { WebSearchOutput } from "@repo/ai/agents/research/schema";
import type { ModelMessage } from "ai";

const googleSearchActiveTools = ["google_search"] satisfies "google_search"[];
const webSearchActiveTools = ["webSearch"] satisfies "webSearch"[];
const webSearchToolChoice = {
  toolName: "webSearch",
  type: "tool",
} satisfies { toolName: "webSearch"; type: "tool" };

/**
 * Returns whether Firecrawl search produced source content that can support an answer.
 */
export function hasUsableWebSearchEvidence(result: WebSearchOutput) {
  if (result.error) {
    return false;
  }

  for (const source of result.sources) {
    const url = source.url.trim();
    const content = source.content.trim();

    if (url && content) {
      return true;
    }
  }

  return false;
}

/**
 * Enables Gemini Google Search grounding after Firecrawl has no usable content.
 *
 * @see https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#preparestep-callback
 */
export function prepareGoogleGroundingStep(messages: ModelMessage[]) {
  const message = {
    role: "user",
    content:
      "Firecrawl did not return usable page content. Use Google Search grounding now to find supporting sources before answering.",
  } satisfies ModelMessage;

  return {
    activeTools: googleSearchActiveTools,
    messages: [...messages, message],
  };
}

/**
 * Starts research with inspectable web evidence before provider grounding.
 *
 * @see https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#preparestep-callback
 */
export function prepareWebSearchStep(hasWebSearchToolCall: boolean) {
  if (hasWebSearchToolCall) {
    return;
  }

  return {
    activeTools: webSearchActiveTools,
    toolChoice: webSearchToolChoice,
  };
}
