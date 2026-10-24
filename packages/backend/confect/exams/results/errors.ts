import { refusal } from "@repo/backend/confect/tenancy/errors";
import { Schema } from "effect";

/** A release asked before its sitting closes, when students would see partial results. */
export class SittingNotClosed extends Schema.TaggedError<SittingNotClosed>()(
  "SittingNotClosed",
  {
    ...refusal(
      "SITTING_NOT_CLOSED",
      "Close the sitting before you release its results."
    ),
  }
) {}
