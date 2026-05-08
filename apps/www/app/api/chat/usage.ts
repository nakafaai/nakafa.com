import { getModelCreditCost, type ModelId } from "@repo/ai/config/models";
import type { ComponentUsage } from "@repo/ai/schema/metadata";
import type { ToolName } from "@repo/ai/schema/tools";
import type { LanguageModelUsage } from "ai";

type MainUsage = Pick<LanguageModelUsage, "inputTokens" | "outputTokens">;

/**
 * Tracks per-turn usage for sub-agent token costs.
 */
export function trackUsage() {
  const subAgents = new Map<ToolName, ComponentUsage>();

  return {
    addUsage: (component: ToolName, usage: LanguageModelUsage) => {
      const input = usage.inputTokens ?? 0;
      const output = usage.outputTokens ?? 0;
      const existing = subAgents.get(component);

      subAgents.set(component, {
        input: (existing?.input ?? 0) + input,
        output: (existing?.output ?? 0) + output,
      });
    },
    metadata: ({
      mainUsage,
      modelId,
    }: {
      mainUsage: MainUsage;
      modelId: ModelId;
    }) => {
      const mainInput = mainUsage.inputTokens ?? 0;
      const mainOutput = mainUsage.outputTokens ?? 0;
      const subAgentTotals = getTotals(subAgents);

      return {
        model: modelId,
        credits: getModelCreditCost(modelId),
        tokens: {
          input: mainInput + subAgentTotals.input,
          output: mainOutput + subAgentTotals.output,
          total: mainInput + mainOutput + subAgentTotals.total,
          breakdown: {
            main: { input: mainInput, output: mainOutput },
            subAgents: Object.fromEntries(subAgents),
          },
        },
      };
    },
  };
}

/**
 * Sums input, output, and total tokens from component usage rows.
 */
function getTotals(usages: Map<ToolName, ComponentUsage>) {
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
