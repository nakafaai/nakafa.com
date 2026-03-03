import type { ToolName } from "@repo/ai/schema/tools";
import type { LanguageModelUsage } from "ai";

/**
 * Agent execution result with token usage.
 * Follows AI SDK GenerateTextResult interface pattern.
 */
export interface AgentResult {
  text: string;
  usage: LanguageModelUsage;
}

/**
 * Token usage for a single component.
 */
interface ComponentUsage {
  input: number;
  output: number;
}

/**
 * Token usage breakdown by component.
 * Main is always present, sub-agents are optional.
 */
export interface TokenUsageBreakdown {
  main: ComponentUsage;
  subAgents: Partial<Record<ToolName, ComponentUsage>>;
}

/**
 * Accumulated token usage with breakdown.
 */
export interface AccumulatedTokenUsage {
  breakdown: TokenUsageBreakdown;
  input: number;
  output: number;
  total: number;
}

/**
 * Accumulator for tracking usage across agent invocations.
 */
export interface UsageAccumulator {
  addUsage: (component: ToolName, usage: LanguageModelUsage) => void;
  getTotal: () => AccumulatedTokenUsage;
}
