import type { ModelId } from "@repo/ai/config/models";
import type { AccumulatedTokenUsage } from "@repo/ai/lib/usage";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import type { UserRole } from "@repo/backend/convex/users/schema";
import type { UIMessageStreamWriter } from "ai";

export interface AgentContext {
  slug: string;
  url: string;
  userRole?: UserRole;
  verified: boolean;
}

/**
 * Token usage accumulator for tracking across sub-agents.
 * Reference: AI SDK experimental_context pattern for sharing state
 */
export interface UsageAccumulator {
  addUsage: (
    component: "contentAccess" | "math" | "research",
    inputTokens: number,
    outputTokens: number
  ) => void;
  getTotal: () => AccumulatedTokenUsage;
}

export interface OrchestratorToolParams {
  context: AgentContext;
  locale: Locale;
  modelId: ModelId;
  /**
   * Accumulator for tracking token usage across sub-agents.
   * Passed through to sub-agents to accumulate usage.
   */
  usageAccumulator: UsageAccumulator;
  writer: UIMessageStreamWriter<MyUIMessage>;
}

export interface ContentAccessAgentParams {
  context: AgentContext;
  locale: Locale;
  modelId: ModelId;
  task: string;
  writer: UIMessageStreamWriter<MyUIMessage>;
}

export interface ResearchAgentParams {
  context: AgentContext;
  locale: Locale;
  modelId: ModelId;
  task: string;
  writer: UIMessageStreamWriter<MyUIMessage>;
}

export interface MathAgentParams {
  context: AgentContext;
  locale: Locale;
  modelId: ModelId;
  task: string;
  writer: UIMessageStreamWriter<MyUIMessage>;
}
