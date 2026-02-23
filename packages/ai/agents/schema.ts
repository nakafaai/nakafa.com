import type { Tool, UIMessageStreamWriter } from "ai";
import * as z from "zod";

/**
 * Agent type enumeration
 */
export const AgentTypeSchema = z.enum([
  "orchestrator",
  "research",
  "study",
  "math",
]);

export type AgentType = z.infer<typeof AgentTypeSchema>;

/**
 * Base agent configuration schema
 *
 * Note: Model is NOT included here because all agents use
 * the user's selected model dynamically at runtime.
 */
export const AgentConfigSchema = z.object({
  id: z.string().describe("Unique identifier for the agent"),
  name: z.string().describe("Human-readable name"),
  description: z.string().describe("Description of agent's capabilities"),
  instructions: z.string().describe("System instructions for the agent"),
  maxSteps: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Maximum steps allowed"),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

/**
 * Tool category schema
 */
export const ToolCategorySchema = z.enum(["research", "study", "math"]);

export type ToolCategory = z.infer<typeof ToolCategorySchema>;

/**
 * Tool registry entry
 *
 * Simple structure for tool registry - all tools use writers
 * for streaming UI updates.
 */
export interface ToolRegistryEntry {
  category: ToolCategory;
  description: string;
  factory: (writer: UIMessageStreamWriter<unknown>) => Tool;
  name: string;
}

/**
 * Sub-agent result schema
 *
 * Simplified - only what the orchestrator needs to receive
 * from sub-agents. Token usage tracked at the message level.
 */
export const SubAgentResultSchema = z.object({
  agentType: AgentTypeSchema.exclude(["orchestrator"]),
  output: z.string().describe("Synthesized text result for parent"),
  usage: z.object({
    input: z.number().describe("Input/prompt tokens used"),
    output: z.number().describe("Output/completion tokens used"),
  }),
});

export type SubAgentResult = z.infer<typeof SubAgentResultSchema>;

/**
 * Delegation input schema
 *
 * Used by the orchestrator's delegate tool
 */
export const DelegateInputSchema = z.object({
  agentType: AgentTypeSchema.exclude(["orchestrator"]),
  task: z.string().describe("Clear description of the task"),
  context: z.string().optional().describe("Additional context"),
});

export type DelegateInput = z.infer<typeof DelegateInputSchema>;
