import { FunctionSpec, GroupSpec } from "@confect/core";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Schema } from "effect";
export default GroupSpec.make().addFunction(
  FunctionSpec.publicQuery({
    name: "hasActiveSubscription",
    args: () => ({
      productId: Schema.String,
    }),
    returns: () => Schema.Boolean,
    error: () => AuthFailure,
  }).middleware(Session)
);
