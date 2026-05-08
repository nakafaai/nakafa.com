import { TOOL_NAMES } from "@repo/ai/agents/orchestrator/names";
import { Effect } from "effect";

/**
 * Forces the orchestrator into Nakafa only for the first verified page fetch.
 *
 * @see https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#preparestep-callback
 * @see https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text
 */
export const prepareNakafaStep = Effect.fn("chat.prepareNakafaStep")(
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
      activeTools: [TOOL_NAMES.nakafa],
      toolChoice: {
        type: "tool" as const,
        toolName: TOOL_NAMES.nakafa,
      },
    });
  }
);
