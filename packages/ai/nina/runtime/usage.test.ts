// @vitest-environment node
import { defaultModel, getModelCreditCost } from "@repo/ai/config/model";
import { trackUsage } from "@repo/ai/nina/runtime/usage";
import { describe, expect, it } from "@repo/testing/effect";
import type { LanguageModelUsage } from "ai";
import { Effect } from "effect";

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

describe("nina/runtime/usage", () => {
  it.live("tracks sub-agent usage and creates final metadata", () =>
    Effect.gen(function* () {
      const usage = yield* trackUsage();

      yield* usage.addUsage("nakafa", usageRow({ input: 2, output: 3 }));
      yield* usage.addUsage("nakafa", usageRow({ input: 5, output: 7 }));
      yield* usage.addUsage(
        "deepResearch",
        usageRow({ input: 11, output: 13 })
      );

      expect(
        yield* usage.metadata({
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
    })
  );

  it.live("defaults missing usage tokens to zero", () =>
    Effect.gen(function* () {
      const usage = yield* trackUsage();

      yield* usage.addUsage(
        "math",
        usageRow({ input: undefined, output: undefined })
      );

      expect(
        (yield* usage.metadata({
          mainUsage: { inputTokens: undefined, outputTokens: undefined },
          modelId: defaultModel,
        })).tokens
      ).toEqual({
        input: 0,
        output: 0,
        total: 0,
        breakdown: {
          main: { input: 0, output: 0 },
          subAgents: {
            math: { input: 0, output: 0 },
          },
        },
      });
    })
  );
});
