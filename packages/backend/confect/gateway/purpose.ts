import type { Effort } from "@repo/backend/confect/gateway/model";
import type { TimeoutConfiguration, ToolSet } from "ai";
import { Schema } from "effect";

/** Why Nakafa calls a model. Spend reports split by it. */
export const Purpose = Schema.Literals([
  "chat",
  "specialist",
  "background",
  "suggestion",
  "presentation",
]);
export type Purpose = typeof Purpose.Type;

/**
 * Each purpose's reasoning effort and deadlines.
 *
 * AI SDK treats `stepMs` as a per-step abort timer and `chunkMs` as the
 * longest gap between streamed chunks, so the chat window allows slower Pro
 * reasoning and web-search steps within its request deadline. Specialists,
 * titles, repairs, summaries, memory, and follow-up suggestions are bounded so
 * a slow provider cannot hold the chat open.
 *
 * @see https://ai-sdk.dev/docs/ai-sdk-core/settings#timeout
 */
export const purposes = {
  chat: {
    effort: "interactive",
    timeout: { chunkMs: 45_000, stepMs: 90_000, totalMs: 420_000 },
  },
  specialist: { effort: "fast", timeout: { stepMs: 30_000, totalMs: 120_000 } },
  background: { effort: "fast", timeout: { stepMs: 15_000, totalMs: 45_000 } },
  suggestion: { effort: "fast", timeout: { stepMs: 30_000, totalMs: 90_000 } },
  presentation: {
    effort: "fast",
    timeout: { stepMs: 15_000, totalMs: 45_000 },
  },
} satisfies Record<
  Purpose,
  { effort: Effort; timeout: TimeoutConfiguration<ToolSet> }
>;
