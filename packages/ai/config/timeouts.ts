import type { TimeoutConfiguration } from "ai";

/** Bounds user-visible chat streams without cutting off ordinary tool flows. */
export const chatStreamTimeout = {
  chunkMs: 30_000,
  stepMs: 45_000,
  totalMs: 180_000,
} satisfies TimeoutConfiguration;

/** Bounds subagent model steps so a slow provider cannot hold the chat open. */
export const subAgentGenerationTimeout = {
  stepMs: 30_000,
  totalMs: 120_000,
} satisfies TimeoutConfiguration;

/** Bounds small background generations such as titles, repairs, and suggestions. */
export const backgroundGenerationTimeout = {
  stepMs: 15_000,
  totalMs: 45_000,
} satisfies TimeoutConfiguration;
