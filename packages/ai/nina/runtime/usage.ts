import { getModelCreditCost, type ModelId } from "@repo/ai/config/model";
import type { LearningCapabilityName } from "@repo/ai/nina/capability/spec";
import type { ComponentUsage } from "@repo/ai/schema/metadata";
import type { LanguageModelUsage } from "ai";
import { Effect, Ref } from "effect";

type MainUsage = Pick<LanguageModelUsage, "inputTokens" | "outputTokens">;

/** Tracks main and specialist token usage for one Nina harness turn. */
export const trackUsage = Effect.fn("nina.usage.track")(function* () {
  const subAgents = yield* Ref.make(
    new Map<LearningCapabilityName, ComponentUsage>()
  );

  /** Adds one specialist usage row to the per-turn aggregate. */
  const addUsage = Effect.fn("nina.usage.add")(function* (
    component: LearningCapabilityName,
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

  /** Builds persisted Nina metadata from main-model and specialist usage. */
  const metadata = Effect.fn("nina.usage.metadata")(function* ({
    mainUsage,
    modelId,
  }: {
    readonly mainUsage: MainUsage;
    readonly modelId: ModelId;
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

/** Sums input, output, and total tokens from component usage rows. */
function getTotals(
  usages: ReadonlyMap<LearningCapabilityName, ComponentUsage>
) {
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
