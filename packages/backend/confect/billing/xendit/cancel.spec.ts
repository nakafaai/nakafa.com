import { FunctionSpec, GroupSpec } from "@confect/core";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { XenditDeactivateError } from "@repo/backend/confect/billing/spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Schema } from "effect";

/**
 * The learner cancels their Xendit Pro plan: it ends with its paid period, and
 * Xendit turns it off in the background, so the settings show the change at once.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicMutation({
      name: "cancelPlan",
      args: () => ({}),
      returns: () => Schema.Null,
      error: () => AuthFailure,
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.internalAction({
      name: "deactivate",
      args: () => ({ planId: Schema.String }),
      returns: () => Schema.Null,
      error: () => XenditDeactivateError,
    })
  );
