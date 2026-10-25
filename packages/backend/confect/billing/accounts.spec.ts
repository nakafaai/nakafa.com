import { FunctionSpec, GroupSpec } from "@confect/core";
import { BillingCountry } from "@repo/backend/confect/billing/schema";
import { LinkPolarCustomerOutcome } from "@repo/backend/confect/billing/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import { Schema } from "effect";

/**
 * Links a Polar customer to the personal account of the Nakafa user its external
 * ID names. The event path and the reconciliation both link through it, so a
 * customer is linked the same way from either.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "linkPolarCustomer",
    args: () => ({
      authId: Schema.String,
      country: BillingCountry,
      providerCustomerId: Schema.String,
    }),
    returns: () => LinkPolarCustomerOutcome,
  }).middleware(Atomic)
);
