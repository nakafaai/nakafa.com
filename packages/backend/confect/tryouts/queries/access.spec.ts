import { FunctionSpec, GroupSpec } from "@confect/core";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TryoutAttemptStateError } from "@repo/backend/confect/tryouts/attempt";
import {
  startAccessArgsValidator,
  TryoutStartError,
  tryoutStartAccessValidator,
} from "@repo/backend/confect/tryouts/start/spec";
import { Schema } from "effect";
export default GroupSpec.make().addFunction(
  FunctionSpec.publicQuery({
    name: "getStartAccess",
    args: () => startAccessArgsValidator.fields,
    returns: () => tryoutStartAccessValidator,
    error: () =>
      Schema.Union([TryoutAttemptStateError, AuthFailure, TryoutStartError]),
  }).middleware(Session)
);
