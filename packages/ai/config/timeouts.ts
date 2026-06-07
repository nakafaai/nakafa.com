import type { TimeoutConfiguration } from "ai";

/**
 * Bounds user-visible chat streams without cutting off normal tool flows.
 *
 * AI SDK treats `stepMs` as a per-step abort timer and `chunkMs` as the
 * maximum gap between streamed chunks, so the main chat window must allow
 * slower Pro reasoning and web-search steps while still preventing runaway
 * requests.
 *
 * @see https://ai-sdk.dev/docs/ai-sdk-core/settings#timeout
 */
export const chatStreamTimeout = {
  chunkMs: 45_000,
  stepMs: 90_000,
  totalMs: 300_000,
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
