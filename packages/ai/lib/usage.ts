import type { LanguageModelUsage } from "ai";

/**
 * Agent execution result with token usage.
 * Follows AI SDK pattern of returning usage alongside text.
 * Reference: AI SDK GenerateTextResult interface
 */
export interface AgentResult {
  text: string;
  usage: LanguageModelUsage;
}

/**
 * Token usage breakdown by agent/component.
 * Allows tracking which parts of the system consume tokens.
 */
export interface TokenUsageBreakdown {
  contentAccess?: {
    input: number;
    output: number;
  };
  main: {
    input: number;
    output: number;
  };
  math?: {
    input: number;
    output: number;
  };
  research?: {
    input: number;
    output: number;
  };
}

/**
 * Accumulated token usage with breakdown.
 * Used to track total usage across main agent and sub-agents.
 */
export interface AccumulatedTokenUsage {
  breakdown: TokenUsageBreakdown;
  input: number;
  output: number;
  total: number;
}

/**
 * Accumulator for tracking usage across agent invocations.
 * Passed through tool context to accumulate usage from sub-agents.
 * Reference: AI SDK experimental_context pattern
 */
export interface UsageAccumulator {
  addUsage: (
    component: keyof TokenUsageBreakdown,
    usage: LanguageModelUsage
  ) => void;
  getTotal: () => AccumulatedTokenUsage;
}
