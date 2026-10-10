import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/** The active Agent turn owns its refundable credit reservation. */
export const NinaCreditHold = Schema.Struct({
  userId: Id("users"),
  credits: Schema.Finite,
  creditsResetAt: Schema.Finite,
  planCreditGrantId: Schema.optionalKey(Id("creditTransactions")),
  transactionId: Id("creditTransactions"),
});

export class NinaCreditError extends Schema.TaggedError<NinaCreditError>()(
  "NinaCreditError",
  {
    code: Schema.Literals([
      "INSUFFICIENT_CREDITS",
      "RATE_LIMITED",
      "NINA_CREDIT_IO_FAILED",
    ]),
    message: Schema.String,
  }
) {}
