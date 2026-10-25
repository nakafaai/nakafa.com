import { Id } from "@repo/backend/confect/_generated/id";
import { CreditLotDraw } from "@repo/backend/confect/credits/schema";
import { Schema } from "effect";

/**
 * The active Agent turn owns its refundable credit reservation. `lots` names the
 * top-up packs the reservation drew from, in the order it drew them. The rest of
 * `credits` came from the allowance. A turn reserved before packs existed has
 * none, so the whole reservation came from the allowance.
 */
export const NinaCreditHold = Schema.Struct({
  userId: Id("users"),
  credits: Schema.Finite,
  creditsResetAt: Schema.Finite,
  planCreditGrantId: Schema.optionalKey(Id("creditTransactions")),
  transactionId: Id("creditTransactions"),
  lots: Schema.optionalKey(Schema.Array(CreditLotDraw)),
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
