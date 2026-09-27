import { FunctionSpec, GroupSpec } from "@confect/core";
import { TryoutAttemptStateErrorWire } from "@repo/backend/confect/tryouts/attempt";
import { TryoutAuthFailure } from "@repo/backend/confect/tryouts/auth";
import {
  startAccessArgsValidator,
  TryoutStartErrorWire,
  tryoutStartAccessValidator,
} from "@repo/backend/confect/tryouts/start/spec";
import { Schema } from "effect";
export default GroupSpec.make().addFunction(
  FunctionSpec.publicQuery({
    name: "getStartAccess",
    args: () => startAccessArgsValidator.fields,
    returns: () => tryoutStartAccessValidator,
    error: () =>
      Schema.Union([
        TryoutAttemptStateErrorWire,
        TryoutAuthFailure,
        TryoutStartErrorWire,
      ]),
  })
);
