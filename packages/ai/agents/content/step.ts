import { Effect } from "effect";

/**
 * Forces the existing getContent tool only for the first content step.
 *
 * @see https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#preparestep-callback
 * @see https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text
 */
export const preparePageFetchStep = Effect.fn("content.preparePageFetchStep")(
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
      activeTools: ["getContent" as const],
      toolChoice: {
        type: "tool" as const,
        toolName: "getContent" as const,
      },
    });
  }
);
