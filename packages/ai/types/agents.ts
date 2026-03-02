import type { ModelId } from "@repo/ai/config/models";
import type { AccumulatedTokenUsage } from "@repo/ai/lib/usage";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import type { UserRole } from "@repo/backend/convex/users/schema";
import type { LanguageModelUsage, UIMessageStreamWriter } from "ai";

export interface AgentContext {
  slug: string;
  url: string;
  userRole?: UserRole;
  verified: boolean;
}

/**
 * Base parameters shared by all agents.
 */
export interface BaseAgentParams {
  context: AgentContext;
  locale: Locale;
  modelId: ModelId;
  writer: UIMessageStreamWriter<MyUIMessage>;
}

/**
 * Parameters for agents that receive a task.
 */
export interface TaskAgentParams extends BaseAgentParams {
  task: string;
}

/**
 * Tool names for type-safe usage tracking.
 */
export type ToolName = "contentAccess" | "deepResearch" | "mathCalculation";

/**
 * Token usage accumulator for tracking across sub-agents.
 */
export interface UsageAccumulator {
  addUsage: (component: ToolName, usage: LanguageModelUsage) => void;
  getTotal: () => AccumulatedTokenUsage;
}

/**
 * Parameters for orchestrator tools.
 */
export interface OrchestratorToolParams extends BaseAgentParams {
  usageAccumulator: UsageAccumulator;
}

/**
 * Agent parameter exports.
 */
export type ContentAccessAgentParams = TaskAgentParams;
export type MathAgentParams = TaskAgentParams;
export type ResearchAgentParams = TaskAgentParams;
