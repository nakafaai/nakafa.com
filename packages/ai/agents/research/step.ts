/**
 * Starts broad research with inspectable web evidence before synthesis.
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
    activeTools: ["webSearch" as const],
    toolChoice: { toolName: "webSearch", type: "tool" } as const,
  };
}
