import type { Nakafa } from "@repo/ai/agents/nakafa/service";
import type { ModelId } from "@repo/ai/config/model";
import type { SourceReference } from "@repo/ai/lib/source";
import type { NinaContextPack } from "@repo/ai/nina/context";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { PromptUserRole } from "@repo/ai/types/roles";
import type {
  CoverageStatus,
  LearningInterest,
  LearningPlanItemStatus,
  LearningProgramKind,
  LearningStage,
} from "@repo/contents/_types/program/schema";
import type { Locale } from "@repo/utilities/locales";
import type { UIMessageStreamWriter } from "ai";

/** Program and plan context agents can use without Convex document coupling. */
export interface AgentLearningProfile {
  interests: readonly LearningInterest[];
  planItems: readonly {
    content_id: string;
    lensId: string;
    position: number;
    route?: string;
    status: LearningPlanItemStatus;
    title?: string;
  }[];
  program: {
    coverageStatus: CoverageStatus;
    key: string;
    kind: LearningProgramKind;
    title: string;
    versionLabel: string;
  };
  stage?: LearningStage;
}

/** Per-turn context shared by Nina and specialist agents after harness arbitration. */
export interface AgentContext {
  currentDate: string;
  learningProfile?: AgentLearningProfile;
  needsPageFetch: boolean;
  nina?: NinaContextPack;
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
