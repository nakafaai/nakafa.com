import { Schema } from "effect";

/** Who writes: the learner who owns the seeded attempt, or another learner. */
export const Caller = Schema.Literals(["learner", "other"]);
export type Caller = typeof Caller.Type;

/**
 * Where a write lands: on the running section or one of its questions, on the
 * section not yet started or its question, or on a target that does not exist.
 */
export const Target = Schema.Literals(["running", "unstarted", "missing"]);
export type Target = typeof Target.Type;

/**
 * What the learner answers on a question: its key, a wrong choice, an answer
 * only the grader can decide, an answer missing some of its parts, a choice
 * the question does not have, a selection of another response kind, or
 * nothing (clearing the answer).
 */
export const Pick = Schema.Literals([
  "correct",
  "incorrect",
  "pending",
  "incomplete",
  "invalid",
  "kind",
  "clear",
]);
export type Pick = typeof Pick.Type;

/**
 * A state the fixture moves its seeded attempt into: the attempt or the
 * running section ended, the attempt's or only the running section's
 * deadline passed, or the running section's row duplicated, which fails any
 * read of it.
 */
export const Change = Schema.Literals([
  "close-attempt",
  "close-section",
  "expire-attempt",
  "expire-section",
  "duplicate-section",
]);
export type Change = typeof Change.Type;

/** A typed failure as the write's function declares it. */
export const Failure = Schema.Struct({
  _tag: Schema.String,
  code: Schema.String,
});
export type Failure = typeof Failure.Type;

/**
 * What the fixture observes after a write: the running section's counters,
 * the stored outcome and version of its question, and whether the section
 * still runs or ended, and how.
 */
export const Observed = Schema.Struct({
  answered: Schema.Finite,
  correct: Schema.Finite,
  outcome: Schema.Option(
    Schema.Literals(["correct", "incorrect", "partial", "pending"])
  ),
  section: Schema.Literals(["running", "submitted", "time-expired"]),
  version: Schema.Option(Schema.Int),
});
export type Observed = typeof Observed.Type;
