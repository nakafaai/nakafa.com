import { FunctionSpec, GroupSpec } from "@confect/core";
import { WelcomeIntentErrorWire } from "@repo/backend/confect/emails/welcome/spec";
import { Schema } from "effect";
export const welcomeIntentReconciliationPhaseValidator = Schema.Literals([
  "scheduled",
  "enqueued",
]);
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "reconcileWelcomeIntentLifecycle",
    args: () => ({
      cursor: Schema.Union([Schema.Null, Schema.String]),
      phase: welcomeIntentReconciliationPhaseValidator,
    }),
    returns: () => Schema.Null,
    error: () => WelcomeIntentErrorWire,
  })
);
