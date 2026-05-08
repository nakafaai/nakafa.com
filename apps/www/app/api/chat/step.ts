import { TOOL_NAMES } from "@repo/ai/agents/orchestrator/names";
import { Effect } from "effect";

/**
 * Forces the orchestrator into content access only for the first page-fetch step.
 *
 * @see https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#preparestep-callback
 * @see https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text
 */
export const prepareContentStep = Effect.fn("chat.prepareContentStep")(
  ({
    needsPageFetch,
    stepNumber,
  }: {
    needsPageFetch: boolean;
    stepNumber: number;
  }) => {
    if (!(needsPageFetch && stepNumber === 0)) {
      return Effect.succeed(undefined);
    }

    return Effect.succeed({
      activeTools: [TOOL_NAMES.contentAccess],
      toolChoice: {
        type: "tool" as const,
        toolName: TOOL_NAMES.contentAccess,
      },
    });
  }
);
