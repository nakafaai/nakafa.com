import { FunctionSpec, GroupSpec } from "@confect/core";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { billingOverviewValidator } from "@repo/backend/confect/billing/schema";
import Session from "@repo/backend/confect/middleware/session.spec";

/** The learner's billing reads, for the settings and pricing screens. */
export default GroupSpec.make().addFunction(
  FunctionSpec.publicQuery({
    name: "overview",
    args: () => ({}),
    returns: () => billingOverviewValidator,
    error: () => AuthFailure,
  }).middleware(Session)
);
