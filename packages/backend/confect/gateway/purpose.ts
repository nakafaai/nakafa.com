import { Effort } from "@repo/backend/confect/gateway/model";
import { Duration, Schema } from "effect";

/** Why Nakafa calls a model. Its reasoning effort and deadlines follow from it. */
export const Purpose = Schema.Literals([
  "chat",
  "specialist",
  "background",
  "suggestion",
  "presentation",
  "import",
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

/** How hard a purpose reasons and how long one call of it may take. */
const Budget = Schema.Struct({
  effort: Effort,
  timeout: Deadline,
});

/**
 * Each purpose's reasoning effort and deadlines. Its output cap is in the
 * language model profile (`confect/gateway/model.ts`). The chat window allows
 * the slowest measured step and the steps of the rest of a turn within its
 * request deadline. Specialists, titles, repairs, summaries, memory, and
 * follow-up suggestions are bounded so a slow provider or a runaway answer
 * cannot hold the chat open or spend without limit.
 *
 * The step deadlines follow the output caps at 278 tokens a second, the rate of
 * the one long answer measured at `high` (30,038 tokens in 108 s, ADR 0020):
 * a step holds its cap with a margin.
 *   - Chat: a full 48,000-token answer takes 48,000 / 278, about 172 s, so the
 *     step is 180 s. The total is that step plus 330 s for the other steps of a
 *     turn, the same allowance as before (420 s less the old 90 s step), so
 *     180 + 330 = 510 s.
 *   - Specialist: 11,264 tokens take about 41 s, so the step is 45 s, and four
 *     steps make the total, as before (4 x 30 s).
 *   - Background: 7,168 tokens take about 26 s, so the step is 30 s, and three
 *     steps make the total, as before (3 x 15 s).
 *   - Suggestion and presentation: their caps take a few seconds, and their
 *     deadlines stay as they were.
 *   - Import: one step reads five pages and writes their questions. Its cap of
 *     16,384 tokens takes about 59 s at that rate, so the step and the total are
 *     75 s, one read at a time from the teacher's browser.
 *
 * @see docs/adr/0020-deadlines.md
 */
export const purposes = {
  chat: {
    effort: "interactive",
    timeout: { chunkMs: 45_000, stepMs: 180_000, totalMs: 510_000 },
  },
  specialist: {
    effort: "fast",
    timeout: { stepMs: 45_000, totalMs: 180_000 },
  },
  background: {
    effort: "fast",
    timeout: { stepMs: 30_000, totalMs: 90_000 },
  },
  suggestion: {
    effort: "fast",
    timeout: { stepMs: 30_000, totalMs: 90_000 },
  },
  presentation: {
    effort: "fast",
    timeout: { stepMs: 15_000, totalMs: 45_000 },
  },
  import: {
    effort: "fast",
    timeout: { stepMs: 75_000, totalMs: 75_000 },
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
