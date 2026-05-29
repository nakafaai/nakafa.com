import { getModelCreditCost, type ModelId } from "@repo/ai/config/model";
import type { ComponentUsage } from "@repo/ai/schema/metadata";
import type { ToolName } from "@repo/ai/schema/tools";
import type { LanguageModelUsage } from "ai";
import { Effect, Ref } from "effect";

type MainUsage = Pick<LanguageModelUsage, "inputTokens" | "outputTokens">;

/**
 * Tracks per-turn usage for sub-agent token costs.
 */
export const trackUsage = Effect.fn("chat.trackUsage")(function* () {
  const subAgents = yield* Ref.make(new Map<ToolName, ComponentUsage>());

  const addUsage = Effect.fn("chat.usage.addUsage")(function* (
    component: ToolName,
    usage: LanguageModelUsage
  ) {
    yield* Ref.update(subAgents, (current) => {
      const input = usage.inputTokens ?? 0;
      const output = usage.outputTokens ?? 0;
      const next = new Map(current);
      const existing = next.get(component);

      next.set(component, {
        input: (existing?.input ?? 0) + input,
        output: (existing?.output ?? 0) + output,
      });

      return next;
    });
  });

  const metadata = Effect.fn("chat.usage.metadata")(function* ({
    mainUsage,
    modelId,
  }: {
    mainUsage: MainUsage;
    modelId: ModelId;
  }) {
    const usages = yield* Ref.get(subAgents);
    const mainInput = mainUsage.inputTokens ?? 0;
    const mainOutput = mainUsage.outputTokens ?? 0;
    const subAgentTotals = getTotals(usages);

    return {
      model: modelId,
      credits: getModelCreditCost(modelId),
      tokens: {
        input: mainInput + subAgentTotals.input,
        output: mainOutput + subAgentTotals.output,
        total: mainInput + mainOutput + subAgentTotals.total,
        breakdown: {
          main: { input: mainInput, output: mainOutput },
          subAgents: Object.fromEntries(usages),
        },
      },
    };
  });

  return {
    addUsage,
    metadata,
  };
});

/**
 * Sums input, output, and total tokens from component usage rows.
 */
function getTotals(usages: ReadonlyMap<ToolName, ComponentUsage>) {
  const input = Array.from(usages.values()).reduce(
    (sum, usage) => sum + usage.input,
    0
  );
  const output = Array.from(usages.values()).reduce(
    (sum, usage) => sum + usage.output,
    0
  );

  return { input, output, total: input + output };
}
