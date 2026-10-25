import { Schema } from "effect";

/** No such target for this learner: it does not exist, or another learner owns it. */
export class Missing extends Schema.TaggedError<Missing>()("Missing", {}) {}

/** The attempt no longer accepts writes: it expired, closed, or was submitted. */
export class AttemptClosed extends Schema.TaggedError<AttemptClosed>()(
  "AttemptClosed",
  {}
) {}

/** A proctor locked the attempt. */
export class Locked extends Schema.TaggedError<Locked>()("Locked", {}) {}

/** The attempt is bound to another device session than the request's, or to none yet. */
export class OtherDevice extends Schema.TaggedError<OtherDevice>()(
  "OtherDevice",
  {}
) {}

/** A proctor retired the request's device session, which may never write again. */
export class DeviceRetired extends Schema.TaggedError<DeviceRetired>()(
  "DeviceRetired",
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

/** The attempt's deadline has not passed yet, so a scheduled expiry has nothing to expire. */
export class NotDue extends Schema.TaggedError<NotDue>()("NotDue", {
  deadline: Schema.Finite,
}) {}

/** The place that holds the target is locked: its school is suspended or its unit archived. */
export class PlaceLocked extends Schema.TaggedError<PlaceLocked>()(
  "PlaceLocked",
  {}
) {}

/** The target has not opened yet. */
export class NotOpen extends Schema.TaggedError<NotOpen>()("NotOpen", {}) {}

/** The target has closed for new attempts. */
export class Closed extends Schema.TaggedError<Closed>()("Closed", {}) {}

/** The first admission rule that failed for one write or entry. */
export class AttemptRefused extends Schema.TaggedError<AttemptRefused>()(
  "AttemptRefused",
  {
    reason: Schema.Union([
      Missing,
      AttemptClosed,
      Locked,
      OtherDevice,
      DeviceRetired,
      SectionClosed,
      Expired,
      NotDue,
      PlaceLocked,
      NotOpen,
      Closed,
    ]),
  }
) {}

/**
 * The answer's version is not newer than the question's latest admitted write,
 * so a newer write already took its place. It is the last refusal, after every
 * admission rule, and only an answer carries a version.
 */
export class Stale extends Schema.TaggedError<Stale>()("Stale", {}) {}

/** The token did not match this sitting, so the device counted one failed try. */
export class TokenRefused extends Schema.TaggedError<TokenRefused>()(
  "TokenRefused",
  {}
) {}

/** A device or a person ran out of tries for this sitting's token. */
export class TooManyTries extends Schema.TaggedError<TooManyTries>()(
  "TooManyTries",
  {}
) {}
