import type { ModelId } from "@repo/ai/config/vercel";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { UserRole as _UserRole } from "@repo/backend/convex/users/schema";
import type { UIMessageStreamWriter } from "ai";

/**
 * User roles within the Nakafa educational platform.
 * Re-exported from backend schema for single source of truth.
 * @see @repo/backend/convex/users/schema
 */
export type UserRole = _UserRole;

/**
 * Contextual information passed from the orchestrator (main agent) to subagents.
 * This provides essential context about the current page, user, and session state,
 * enabling subagents to make informed decisions and efficient tool calls.
 *
 * @example
 * {
 *   url: "/id/subject/sma/11/mathematics/function-composition",
 *   slug: "subject/sma/11/mathematics/function-composition",
 *   verified: true,
 *   userRole: "student"
 * }
 */
export interface AgentContext {
  /**
   * The content slug without the locale prefix.
   * Used to identify specific educational content.
   * @example "subject/sma/11/mathematics/function-composition"
   */
  slug: string;
  /**
   * The full URL path of the current page.
   * Format: `/${locale}/${slug}`
   * @example "/id/subject/sma/11/mathematics/function-composition"
   */
  url: string;

  /**
   * The user's role within the platform, determining the AI's interaction style.
   * Used to personalize responses and tool behavior.
   */
  userRole?: UserRole;

  /**
   * Indicates whether the current page/slug has been verified to exist
   * in the Nakafa content system. When true, getContent can be called directly.
   */
  verified: boolean;
}

/**
 * Parameters required for creating orchestrator tools.
 * Passed from the API route to the tool factory functions.
 *
 * @example
 * const tools = orchestratorTools({
 *   writer,
 *   modelId: "gpt-4o",
 *   locale: "id",
 *   context: { url, slug, verified, userRole }
 * });
 */
export interface OrchestratorToolParams {
  /**
   * Contextual information about the current page and user.
   */
  context: AgentContext;

  /**
   * The locale/language code for the current session.
   * @example "id" | "en"
   */
  locale: string;

  /**
   * The model ID to use for subagent execution.
   */
  modelId: ModelId;
  /**
   * The UI message stream writer for sending data parts to the client.
   */
  writer: UIMessageStreamWriter<MyUIMessage>;
}

/**
 * Parameters for running a content access subagent.
 * The content access agent retrieves educational content from Nakafa's database.
 */
export interface ContentAccessAgentParams {
  /**
   * Context about the current page and user.
   */
  context: AgentContext;

  /**
   * The locale for content retrieval.
   */
  locale: string;

  /**
   * The model ID to use for the agent.
   */
  modelId: ModelId;
  /**
   * The task description with full context about what content to retrieve.
   */
  task: string;

  /**
   * The UI message stream writer for sending data parts (loading states, results).
   */
  writer: UIMessageStreamWriter<MyUIMessage>;
}

/**
 * Parameters for running a research subagent.
 * The research agent conducts web searches and scrapes sources.
 */
export interface ResearchAgentParams {
  /**
   * Context about the current page and user.
   */
  context: AgentContext;

  /**
   * The locale for research queries.
   */
  locale: string;

  /**
   * The model ID to use for the agent.
   */
  modelId: ModelId;
  /**
   * The research task description with full context.
   */
  task: string;

  /**
   * The UI message stream writer for sending data parts.
   */
  writer: UIMessageStreamWriter<MyUIMessage>;
}

/**
 * Parameters for running a math calculation subagent.
 * The math agent performs calculations using a calculator tool.
 */
export interface MathAgentParams {
  /**
   * Context about the current page and user.
   */
  context: AgentContext;

  /**
   * The locale for the agent.
   */
  locale: string;

  /**
   * The model ID to use for the agent.
   */
  modelId: ModelId;
  /**
   * The mathematical problem or expression to solve.
   */
  task: string;

  /**
   * The UI message stream writer for sending data parts.
   */
  writer: UIMessageStreamWriter<MyUIMessage>;
}
