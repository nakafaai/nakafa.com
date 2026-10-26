import { refusal } from "@repo/backend/confect/tenancy/errors";
import { Schema } from "effect";

/**
 * A student under the age limit with no guardian's consent on record, refused
 * before Nina, the class forum, and active grading (ADR 0034, K2).
 */
export class ConsentRequired extends Schema.TaggedError<ConsentRequired>()(
  "ConsentRequired",
  refusal(
    "CONSENT_REQUIRED",
    "A parent or guardian must give consent before this student can use it."
  )
) {}

/**
 * A link that staff may not start: the Person is not an active student of the
 * school, or the address already has a live link to the student.
 */
export class LinkRefused extends Schema.TaggedError<LinkRefused>()(
  "LinkRefused",
  {
    code: Schema.Literals(["NOT_STUDENT", "ALREADY_LINKED"]),
    message: Schema.String,
  }
) {}

/** A link that is not waiting for a check, so it cannot be verified. */
export class LinkClosed extends Schema.TaggedError<LinkClosed>()(
  "LinkClosed",
  refusal("LINK_CLOSED", "This link is not waiting for a check.")
) {}
