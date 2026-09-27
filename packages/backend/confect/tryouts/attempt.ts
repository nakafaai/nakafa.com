import { failureWire } from "@repo/backend/confect/failure";
import { Schema } from "effect";

/** The requested immutable attempt or section cannot accept this operation. */
export class TryoutAttemptStateError extends Schema.TaggedError<TryoutAttemptStateError>()(
  "TryoutAttemptStateError",
  {
    code: Schema.Literals([
      "TRYOUT_ATTEMPT_NOT_FOUND",
      "TRYOUT_ATTEMPT_NOT_ACTIVE",
      "TRYOUT_SECTION_NOT_FOUND",
      "TRYOUT_SECTION_NOT_ACTIVE",
    ]),
    message: Schema.String,
  }
) {}
export const TryoutAttemptStateErrorWire = failureWire(TryoutAttemptStateError);
