import { Effort } from "@repo/backend/confect/gateway/model";
import { Schema } from "effect";

/** Why Nakafa calls a model. Its reasoning effort and deadlines follow from it. */
export const Purpose = Schema.Literals([
  "chat",
  "specialist",
  "background",
  "suggestion",
  "presentation",
]);
export type Purpose = typeof Purpose.Type;

/**
 * How long one call may run, in the AI SDK's timeout terms: `totalMs` bounds
 * the call, `stepMs` each step, and `chunkMs` the longest gap between
 * streamed chunks.
 *
 * @see https://ai-sdk.dev/docs/ai-sdk-core/settings#timeout
 */
export const Deadline = Schema.Struct({
  totalMs: Schema.Int,
  stepMs: Schema.Int,
  chunkMs: Schema.optionalKey(Schema.Int),
});
export type Deadline = typeof Deadline.Type;

/** How hard a purpose reasons and how long it may take. */
const Budget = Schema.Struct({ effort: Effort, timeout: Deadline });

/**
 * Each purpose's reasoning effort and deadlines. The chat window allows
 * slower Pro reasoning and web-search steps within its request deadline.
 * Specialists, titles, repairs, summaries, memory, and follow-up suggestions
 * are bounded so a slow provider cannot hold the chat open.
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
} satisfies Record<Purpose, typeof Budget.Type>;
