import type { WebSearchOutput } from "@repo/ai/agents/research/schema";
import type { ModelMessage } from "ai";

const googleSearchActiveTools = ["google_search"] satisfies "google_search"[];
const googleSearchToolChoice = "required" as const;
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
      "Firecrawl webSearch returned no usable source content. Google Search grounding is now enabled as the only active provider tool. Use it for public evidence before answering. If no grounding sources are returned, say no public source was found and do not cite Google Search.",
  } satisfies ModelMessage;

  return {
    activeTools: googleSearchActiveTools,
    toolChoice: googleSearchToolChoice,
    messages: [...messages, message],
  };
}

/**
 * Starts broad research with inspectable web evidence before provider grounding.
 *
 * @see https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#preparestep-callback
 */
export function prepareResearchEvidenceStep({
  hasWebSearchToolCall,
}: {
  hasWebSearchToolCall: boolean;
}) {
  if (hasWebSearchToolCall) {
    return;
  }

  return {
    activeTools: webSearchActiveTools,
    toolChoice: webSearchToolChoice,
  };
}
