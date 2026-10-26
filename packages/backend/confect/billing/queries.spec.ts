import { FunctionSpec, GroupSpec } from "@confect/core";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { BillingCurrency } from "@repo/backend/confect/billing/catalog";
import { billingOverviewValidator } from "@repo/backend/confect/billing/schema";
import { ProCheckoutOffer } from "@repo/backend/confect/billing/spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Schema } from "effect";

/**
 * The Pro offers sold in one currency, each at its price on the rail that sells
 * it there: Polar's monthly plan alone, or Xendit's monthly plan and passes once
 * Xendit takes Indonesia.
 */
export const ProOffers = Schema.Array(
  Schema.Struct({
    offer: ProCheckoutOffer,
    amount: Schema.Int,
    currency: BillingCurrency,
    months: Schema.Int,
  })
);

/** The learner's billing reads, for the settings and pricing screens. The offers need no session, since they name no viewer. */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "overview",
      args: () => ({}),
      returns: () => billingOverviewValidator,
      error: () => AuthFailure,
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "proOffers",
      args: () => ({ currency: BillingCurrency }),
      returns: () => ProOffers,
    })
  );
