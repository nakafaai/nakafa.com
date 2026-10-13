import { Schema } from "effect";

/** No such target for this learner: it does not exist, or another learner owns it. */
export class Missing extends Schema.TaggedError<Missing>()("Missing", {}) {}

/** The attempt no longer accepts writes: it was submitted, expired, or ended. */
export class AttemptClosed extends Schema.TaggedError<AttemptClosed>()(
  "AttemptClosed",
  {}
) {}

/** A proctor locked the attempt. */
export class Locked extends Schema.TaggedError<Locked>()("Locked", {}) {}

/** The attempt is bound to another device session than the request's. */
export class OtherDevice extends Schema.TaggedError<OtherDevice>()(
  "OtherDevice",
  {}
) {}

/** The section never started or no longer accepts writes. */
export class SectionClosed extends Schema.TaggedError<SectionClosed>()(
  "SectionClosed",
  {}
) {}

/** The server time reached the deadline the write's rule checks, in milliseconds. */
export class Expired extends Schema.TaggedError<Expired>()("Expired", {
  deadline: Schema.Finite,
}) {}

/** The first admission rule that failed for one write to a live attempt. */
export class AttemptRefused extends Schema.TaggedError<AttemptRefused>()(
  "AttemptRefused",
  {
    reason: Schema.Union([
      Missing,
      AttemptClosed,
      Locked,
      OtherDevice,
      SectionClosed,
      Expired,
    ]),
  }
) {}

/**
 * The answer's version is not newer than the question's latest admitted write,
 * so a newer write already took its place. It is the last refusal, after every
 * admission rule, and only an answer carries a version.
 */
export class Stale extends Schema.TaggedError<Stale>()("Stale", {}) {}
