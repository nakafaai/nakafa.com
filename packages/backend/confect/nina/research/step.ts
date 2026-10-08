/**
 * Starts broad research with one forced, inspectable web search. Once it has
 * run, the next step writes the evidence notes from its results with no tools.
 *
 * @see https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#preparestep-callback
 */
export function prepareResearchEvidenceStep({
  hasWebSearchToolCall,
}: {
  hasWebSearchToolCall: boolean;
}) {
  if (hasWebSearchToolCall) {
    return { activeTools: [] };
  }

  return {
    activeTools: ["webSearch" as const],
    toolChoice: { toolName: "webSearch", type: "tool" } as const,
  };
}
