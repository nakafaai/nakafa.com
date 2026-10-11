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

/**
 * How hard a purpose reasons, how long it may take, and the most one call may
 * write. `maxOutputTokens` is the AI SDK's setting for a maximum output. A call
 * that ends at the cap finishes with `length`, which a chat turn reads as
 * `response-limit`.
 */
const Budget = Schema.Struct({
  effort: Effort,
  maxOutputTokens: Schema.Int,
  timeout: Deadline,
});

/**
 * Each purpose's reasoning effort, output cap, and deadlines. The chat window
 * allows slower reasoning and web-search steps within its request deadline.
 * Specialists, titles, repairs, summaries, memory, and follow-up suggestions
 * are bounded so a slow provider or a runaway answer cannot hold the chat open
 * or spend without limit.
 */
export const purposes = {
  chat: {
    effort: "interactive",
    maxOutputTokens: 8192,
    timeout: { chunkMs: 45_000, stepMs: 90_000, totalMs: 420_000 },
  },
  specialist: {
    effort: "fast",
    maxOutputTokens: 4096,
    timeout: { stepMs: 30_000, totalMs: 120_000 },
  },
  background: {
    effort: "fast",
    maxOutputTokens: 1024,
    timeout: { stepMs: 15_000, totalMs: 45_000 },
  },
  suggestion: {
    effort: "fast",
    maxOutputTokens: 512,
    timeout: { stepMs: 30_000, totalMs: 90_000 },
  },
  presentation: {
    effort: "fast",
    maxOutputTokens: 512,
    timeout: { stepMs: 15_000, totalMs: 45_000 },
  },
} satisfies Record<Purpose, typeof Budget.Type>;
