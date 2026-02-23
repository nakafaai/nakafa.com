# Task 1.1: Create Agent Schemas

## Goal
Create Zod schemas for agent configuration and types

## Context
Provides type-safe configuration for all agents using Zod instead of TypeScript interfaces

## Implementation

**File**: `packages/ai/agents/schema.ts`

```typescript
import * as z from "zod";

/**
 * Agent type enumeration
 */
export const AgentTypeSchema = z.enum([
  "orchestrator",
  "research", 
  "content",
  "analysis",
  "web",
]);

export type AgentType = z.infer<typeof AgentTypeSchema>;

/**
 * Base agent configuration schema
 */
export const AgentConfigSchema = z.object({
  id: z.string().describe("Unique identifier for the agent"),
  name: z.string().describe("Human-readable name"),
  description: z.string().describe("Description of agent's capabilities"),
  instructions: z.string().describe("System instructions for the agent"),
  maxSteps: z.number().int().min(1).max(50).default(10)
    .describe("Maximum steps allowed"),
  model: z.string().default("claude-sonnet-4-5")
    .describe("Model ID to use"),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

/**
 * Tool category schema
 */
export const ToolCategorySchema = z.enum([
  "research",
  "content", 
  "analysis",
  "web",
  "utility",
]);

export type ToolCategory = z.infer<typeof ToolCategorySchema>;

/**
 * Tool definition schema
 */
export const ToolDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  category: ToolCategorySchema,
  requiresWriter: z.boolean().default(true),
});

export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

/**
 * Sub-agent result schema
 */
export const SubAgentResultSchema = z.object({
  agentId: z.string(),
  success: z.boolean(),
  output: z.string(),
  toolCalls: z.array(z.object({
    toolName: z.string(),
    input: z.unknown(),
    output: z.unknown(),
  })),
  tokenUsage: z.object({
    input: z.number(),
    output: z.number(),
    total: z.number(),
  }),
  duration: z.number().optional(),
});

export type SubAgentResult = z.infer<typeof SubAgentResultSchema>;

/**
 * Orchestrator decision schema
 */
export const OrchestratorDecisionSchema = z.object({
  reasoning: z.string().describe("Reasoning for the decision"),
  subAgentsToSpawn: z.array(z.object({
    agentType: AgentTypeSchema.exclude(["orchestrator"]),
    task: z.string(),
    priority: z.enum(["high", "medium", "low"]),
  })),
  parallelExecution: z.boolean().describe("Whether to execute in parallel"),
});

export type OrchestratorDecision = z.infer<typeof OrchestratorDecisionSchema>;

/**
 * Delegation input schema
 */
export const DelegateInputSchema = z.object({
  agentType: AgentTypeSchema.exclude(["orchestrator"]),
  task: z.string().describe("Clear description of the task"),
  context: z.string().optional().describe("Additional context"),
});

export type DelegateInput = z.infer<typeof DelegateInputSchema>;

/**
 * Delegation output schema
 */
export const DelegateOutputSchema = z.object({
  status: z.enum(["started", "progress", "completed", "error"]),
  agentType: AgentTypeSchema.exclude(["orchestrator"]),
  result: z.string().optional(),
  error: z.string().optional(),
  timestamp: z.number(),
});

export type DelegateOutput = z.infer<typeof DelegateOutputSchema>;
