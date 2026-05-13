import { TOOL_NAMES } from "@repo/ai/agents/orchestrator/names";
import { runResearchAgent } from "@repo/ai/agents/research/agent";
import type {
  ResearchAgentParams,
  UsageAccumulator,
} from "@repo/ai/types/agents";
import { Effect } from "effect";

interface ResearchToolParams extends Omit<ResearchAgentParams, "task"> {
  usageAccumulator: UsageAccumulator;
}

/**
 * Runs the research subagent and records its token usage.
 */
export const runResearch = Effect.fn("orchestrator.runResearch")(function* ({
  context,
  locale,
  modelId,
  query,
  toolCallId,
  usageAccumulator,
  writer,
}: ResearchToolParams & { query: string }) {
  const result = yield* runResearchAgent({
    task: query,
    toolCallId,
    writer,
    modelId,
    locale,
    context,
  });

  yield* Effect.sync(() =>
    usageAccumulator.addUsage(TOOL_NAMES.deepResearch, result.usage)
  );

  return result.text;
});
