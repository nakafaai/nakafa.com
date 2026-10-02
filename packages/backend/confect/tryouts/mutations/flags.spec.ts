import { FunctionSpec, GroupSpec } from "@confect/core";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TryoutAttemptStateError } from "@repo/backend/confect/tryouts/attempt";
import {
  setTryoutFlagArgsValidator,
  setTryoutFlagResultValidator,
  TryoutFlagErrorWire,
} from "@repo/backend/confect/tryouts/flag/spec";
import { TryoutResponseIntegrityError } from "@repo/backend/confect/tryouts/response/spec";
import { TryoutRuntimeErrorWire } from "@repo/backend/confect/tryouts/runtime/error";
import { Schema } from "effect";
export default GroupSpec.make().addFunction(
  FunctionSpec.publicMutation({
    name: "set",
    args: () => setTryoutFlagArgsValidator.fields,
    returns: () => setTryoutFlagResultValidator,
    error: () =>
      Schema.Union([
        TryoutAttemptStateError,
        AuthFailure,
        TryoutFlagErrorWire,
        TryoutRuntimeErrorWire,
        TryoutResponseIntegrityError,
      ]),
  }).middleware(Session)
);
