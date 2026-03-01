import type { ModelId } from "@repo/ai/config/models";
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

export interface OrchestratorToolParams {
  context: AgentContext;
  locale: Locale;
  modelId: ModelId;
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
