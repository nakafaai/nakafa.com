import type { Nakafa } from "@repo/ai/agents/nakafa/service";
import type { ModelId } from "@repo/ai/config/model";
import type { SourceReference } from "@repo/ai/lib/source";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { PromptUserRole } from "@repo/ai/types/roles";
import type { Locale } from "@repo/utilities/locales";
import type { UIMessageStreamWriter } from "ai";

export interface AgentContext {
  currentDate: string;
  needsPageFetch: boolean;
  slug: string;
  url: string;
  userRole?: PromptUserRole;
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

/** Parameters for the Nakafa content retrieval subagent. */
export interface NakafaAgentParams extends TaskAgentParams {
  nakafa: Nakafa;
}

/** Parameters for the external research subagent. */
export interface ResearchAgentParams extends BaseAgentParams {
  sourceReferences: SourceReference[];
  task: string;
  toolCallId: string;
}

/**
 * Agent parameter exports.
 */
export type MathAgentParams = TaskAgentParams;
