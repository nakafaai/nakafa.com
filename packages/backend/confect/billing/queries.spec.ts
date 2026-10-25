import { FunctionSpec, GroupSpec } from "@confect/core";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Schema } from "effect";

/** The learner's billing reads, for the settings and pricing screens. */
export default GroupSpec.make().addFunction(
  FunctionSpec.publicQuery({
    name: "hasActiveSubscription",
    args: () => ({}),
    returns: () => Schema.Boolean,
    error: () => AuthFailure,
  }).middleware(Session)
);
