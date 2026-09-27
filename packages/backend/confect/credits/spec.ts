import { Schema } from "effect";

/** A materialized credit boundary could not be read or changed safely. */
export class CreditStateError extends Schema.TaggedError<CreditStateError>()(
  "CreditStateError",
  {
    code: Schema.Literal("CREDIT_STATE_FAILED"),
    message: Schema.Literal(
      "Unable to read or update the credit reset period."
    ),
  }
) {}
