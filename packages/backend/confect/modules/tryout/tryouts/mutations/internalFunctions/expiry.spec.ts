import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { Schema } from "effect";

const tryoutsMutationsInternalExpiryGroup = GroupSpec.make("expiry")
  .addFunction(
    FunctionSpec.internalMutation({
      name: "expireTryoutAttemptInternal",
      args: Schema.Struct({
        expiresAtMs: Schema.Number,
        tryoutAttemptId: GenericId.GenericId("tryoutAttempts"),
      }),
      returns: Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "sweepExpiredTryoutAttempts",
      args: Schema.Struct({}),
      returns: Schema.Null,
    })
  );

export { tryoutsMutationsInternalExpiryGroup };
