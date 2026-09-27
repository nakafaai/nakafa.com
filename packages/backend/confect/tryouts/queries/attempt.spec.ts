import { FunctionSpec, GroupSpec } from "@confect/core";
import { TryoutAttemptStateErrorWire } from "@repo/backend/confect/tryouts/attempt";
import { TryoutAuthFailure } from "@repo/backend/confect/tryouts/auth";
import { TryoutRuntimeErrorWire } from "@repo/backend/confect/tryouts/runtime/error";
import { Schema } from "effect";

/** Reports whether one exact owned attempt must lock the app shell. */
export default GroupSpec.make().addFunction(
  FunctionSpec.publicQuery({
    name: "isLockedByAttemptId",
    args: () => ({
      attemptId: Schema.String,
    }),
    returns: () => Schema.Boolean,
    error: () =>
      Schema.Union([
        TryoutAttemptStateErrorWire,
        TryoutAuthFailure,
        TryoutRuntimeErrorWire,
      ]),
  })
);
