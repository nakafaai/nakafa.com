import { Effect } from "effect";

/**
 * Forces the orchestrator into content access only for the first page-fetch step.
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
      activeTools: ["contentAccess" as const],
      toolChoice: {
        type: "tool" as const,
        toolName: "contentAccess" as const,
      },
    });
  }
);
