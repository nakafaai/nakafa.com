import { Effort } from "@repo/backend/confect/gateway/model";
import { Duration, Schema } from "effect";

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
 * write. `maxOutputTokens` is the AI SDK's setting for a maximum output, and
 * the model's reasoning tokens count toward it. A call that ends at the cap
 * finishes with `length`, which a chat turn reads as `response-limit`.
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
 *
 * The caps stand well above what a real call wrote when they were measured on
 * Gemini 3.8 Flash through the gateway (11 October 2026, ADR 0020). A chat
 * answer the learner asked to be very long wrote 9,593 tokens, 2,055 of them
 * reasoning, and a proof reasoned for 4,366. A summary wrote 1,042 and may
 * hold 1,200. A specialist's answer is read up to 6,000 tokens, so its cap
 * sits just above that.
 */
export const purposes = {
  chat: {
    effort: "interactive",
    maxOutputTokens: 16_384,
    timeout: { chunkMs: 45_000, stepMs: 90_000, totalMs: 420_000 },
  },
  specialist: {
    effort: "fast",
    maxOutputTokens: 6144,
    timeout: { stepMs: 30_000, totalMs: 120_000 },
  },
  background: {
    effort: "fast",
    maxOutputTokens: 2048,
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

/**
 * How long one decision may take, its retries included. A decision is one short
 * request with no streamed answer: the gateway answered in 140 to 310 ms when
 * measured on the dev deployment on 12 October 2026 (ADR 0019). Two retries wait
 * 2 and 4 seconds, so ten seconds hold all three attempts, and a request that is
 * still open after it has hung.
 */
export const decisionDeadline = Duration.seconds(10);
