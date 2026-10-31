import { refusal } from "@repo/backend/confect/tenancy/errors";
import { Schema } from "effect";

/**
 * A link that staff may not start: the Person is not an active student of the
 * school, or the address already has a live link to the student.
 */
export class LinkRefused extends Schema.TaggedError<LinkRefused>()(
  "LinkRefused",
  {
    code: Schema.Literals(["NOT_STUDENT", "ALREADY_LINKED", "LINK_LIMIT"]),
    message: Schema.String,
  }
) {}

/** A link that is not waiting for a check, so it cannot be verified. */
export class LinkClosed extends Schema.TaggedError<LinkClosed>()(
  "LinkClosed",
  refusal("LINK_CLOSED", "This link is not waiting for a check.")
) {}
