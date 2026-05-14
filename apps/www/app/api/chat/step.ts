import { TOOL_NAMES } from "@repo/ai/agents/orchestrator/names";
import { Effect } from "effect";

/**
 * Forces page fetches through Nakafa while allowing direct-answer turns.
 *
 * @see https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#preparestep-callback
 * @see https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text
 */
export const prepareChatStep = Effect.fn("chat.prepareChatStep")(
  ({
    needsPageFetch,
    stepNumber,
  }: {
    needsPageFetch: boolean;
    stepNumber: number;
  }) => {
    if (stepNumber !== 0) {
      return Effect.succeed(undefined);
    }

    if (!needsPageFetch) {
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
