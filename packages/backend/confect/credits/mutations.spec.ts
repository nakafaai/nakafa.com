import { FunctionSpec, GroupSpec } from "@confect/core";
import { CreditStateError } from "@repo/backend/confect/credits/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import { userPlanValidator } from "@repo/backend/confect/users/schema";
import { Schema } from "effect";
/** Synchronizes one plan's materialized reset boundary with the current time. */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "syncCreditResetPeriod",
      args: () => ({
        plan: userPlanValidator,
      }),
      returns: () => Schema.Null,
      error: () => CreditStateError,
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "syncAllCreditResetPeriods",
      args: () => ({}),
      returns: () => Schema.Null,
      error: () => CreditStateError,
    }).middleware(Atomic)
  );
