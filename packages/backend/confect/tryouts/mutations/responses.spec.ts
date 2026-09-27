import { FunctionSpec, GroupSpec } from "@confect/core";
import { TryoutAttemptStateErrorWire } from "@repo/backend/confect/tryouts/attempt";
import { TryoutAuthFailure } from "@repo/backend/confect/tryouts/auth";
import {
  saveTryoutResponseArgsValidator,
  saveTryoutResponseResultValidator,
  TryoutResponseErrorWire,
  TryoutResponseIntegrityErrorWire,
  TryoutResponseSelectionErrorWire,
} from "@repo/backend/confect/tryouts/response/spec";
import { TryoutRuntimeErrorWire } from "@repo/backend/confect/tryouts/runtime/error";
import { Schema } from "effect";
export default GroupSpec.make().addFunction(
  FunctionSpec.publicMutation({
    name: "save",
    args: () => saveTryoutResponseArgsValidator.fields,
    returns: () => saveTryoutResponseResultValidator,
    error: () =>
      Schema.Union([
        TryoutAttemptStateErrorWire,
        TryoutAuthFailure,

        TryoutResponseErrorWire,
        TryoutRuntimeErrorWire,
        TryoutResponseIntegrityErrorWire,
        TryoutResponseSelectionErrorWire,
      ]),
  })
);
