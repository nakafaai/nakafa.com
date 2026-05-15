import type { ModelMessage } from "ai";

const googleSearchActiveTools = ["google_search"] satisfies "google_search"[];
const googleSearchToolChoice = "required" as const;
const webSearchActiveTools = ["webSearch"] satisfies "webSearch"[];
const webSearchToolChoice = {
  toolName: "webSearch",
  type: "tool",
} satisfies { toolName: "webSearch"; type: "tool" };

/**
 * Enables Gemini Google Search grounding after inspectable Firecrawl search.
 *
 * @see https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#preparestep-callback
 */
export function prepareGoogleGroundingStep(messages: ModelMessage[]) {
  const message = {
    role: "user",
    content:
      "Firecrawl webSearch is complete. Google Search grounding is now enabled as the only active provider tool. Use it to corroborate current public evidence before answering. Keep source titles and URLs attached to evidence notes. If Google returns no grounding sources, state that limitation and do not cite Google Search.",
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
