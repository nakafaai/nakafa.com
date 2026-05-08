import { defaultModel, getModelCreditCost } from "@repo/ai/config/models";
import type { LanguageModelUsage } from "ai";
import { describe, expect, it } from "vitest";
import { trackUsage } from "@/app/api/chat/usage";

/**
 * Returns one complete AI SDK usage row for usage-tracker tests.
 */
function usageRow({
  input,
  output,
}: {
  input: number | undefined;
  output: number | undefined;
}) {
  return {
    inputTokens: input,
    inputTokenDetails: {
      cacheReadTokens: undefined,
      cacheWriteTokens: undefined,
      noCacheTokens: input,
    },
    outputTokens: output,
    outputTokenDetails: {
      reasoningTokens: undefined,
      textTokens: output,
    },
    totalTokens:
      input === undefined || output === undefined ? undefined : input + output,
  } satisfies LanguageModelUsage;
}

describe("app/api/chat/usage", () => {
  it("tracks sub-agent usage and creates final metadata", () => {
    const usage = trackUsage();

    usage.addUsage("nakafa", usageRow({ input: 2, output: 3 }));
    usage.addUsage("nakafa", usageRow({ input: 5, output: 7 }));
    usage.addUsage("deepResearch", usageRow({ input: 11, output: 13 }));

    expect(
      usage.metadata({
        mainUsage: { inputTokens: 17, outputTokens: 19 },
        modelId: defaultModel,
      })
    ).toEqual({
      model: defaultModel,
      credits: getModelCreditCost(defaultModel),
      tokens: {
        input: 35,
        output: 42,
        total: 77,
        breakdown: {
          main: { input: 17, output: 19 },
          subAgents: {
            nakafa: { input: 7, output: 10 },
            deepResearch: { input: 11, output: 13 },
          },
        },
      },
    });
  });

  it("defaults missing usage tokens to zero", () => {
    const usage = trackUsage();

    usage.addUsage(
      "mathCalculation",
      usageRow({ input: undefined, output: undefined })
    );

    expect(
      usage.metadata({
        mainUsage: { inputTokens: undefined, outputTokens: undefined },
        modelId: defaultModel,
      }).tokens
    ).toEqual({
      input: 0,
      output: 0,
      total: 0,
      breakdown: {
        main: { input: 0, output: 0 },
        subAgents: {
          mathCalculation: { input: 0, output: 0 },
        },
      },
    });
  });
});
