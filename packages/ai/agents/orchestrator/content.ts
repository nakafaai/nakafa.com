import { runContentAgent } from "@repo/ai/agents/content/agent";
import { TOOL_NAMES } from "@repo/ai/agents/orchestrator/names";
import type {
  ContentAgentParams,
  UsageAccumulator,
} from "@repo/ai/types/agents";
import { Effect } from "effect";

interface ContentToolParams extends Omit<ContentAgentParams, "task"> {
  usageAccumulator: UsageAccumulator;
}

/**
 * Runs the content subagent and records its token usage.
 */
export const runContent = Effect.fn("orchestrator.runContent")(function* ({
  context,
  locale,
  modelId,
  query,
  usageAccumulator,
  writer,
}: ContentToolParams & { query: string }) {
  const result = yield* runContentAgent({
    task: query,
    writer,
    modelId,
    locale,
    context,
  });

  yield* Effect.sync(() =>
    usageAccumulator.addUsage(TOOL_NAMES.contentAccess, result.usage)
  );

  return result.text;
});
