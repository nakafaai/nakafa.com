import { FunctionSpec, GroupSpec } from "@confect/core";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TryoutAttemptStateError } from "@repo/backend/confect/tryouts/attempt";
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
        TryoutAttemptStateError,
        AuthFailure,
        TryoutRuntimeErrorWire,
      ]),
  }).middleware(Session)
);
