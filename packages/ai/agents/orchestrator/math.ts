import { runMathAgent } from "@repo/ai/agents/math/agent";
import { TOOL_NAMES } from "@repo/ai/agents/orchestrator/names";
import type { MathAgentParams, UsageAccumulator } from "@repo/ai/types/agents";
import { Effect } from "effect";

interface MathToolParams extends Omit<MathAgentParams, "task"> {
  usageAccumulator: UsageAccumulator;
}

/**
 * Runs the math subagent and records its token usage.
 */
export const runMath = Effect.fn("orchestrator.runMath")(function* ({
  context,
  locale,
  modelId,
  query,
  usageAccumulator,
  writer,
}: MathToolParams & { query: string }) {
  const result = yield* runMathAgent({
    task: query,
    writer,
    modelId,
    locale,
    context,
  });

  yield* Effect.sync(() =>
    usageAccumulator.addUsage(TOOL_NAMES.mathCalculation, result.usage)
  );

  return result.text;
});
