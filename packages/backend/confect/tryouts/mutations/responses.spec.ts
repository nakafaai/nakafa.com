import { FunctionSpec, GroupSpec } from "@confect/core";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TryoutAttemptStateError } from "@repo/backend/confect/tryouts/attempt";
import {
  TryoutProgressError,
  TryoutProgressSizeError,
} from "@repo/backend/confect/tryouts/progress/spec";
import {
  saveTryoutResponseArgsValidator,
  saveTryoutResponseResultValidator,
  TryoutResponseErrorWire,
  TryoutResponseIntegrityError,
  TryoutResponseSelectionError,
  tryoutFlagArgsValidator,
} from "@repo/backend/confect/tryouts/response/spec";
import { TryoutRuntimeErrorWire } from "@repo/backend/confect/tryouts/runtime/error";
import { Schema } from "effect";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicMutation({
      name: "save",
      args: () => saveTryoutResponseArgsValidator.fields,
      returns: () => saveTryoutResponseResultValidator,
      error: () =>
        Schema.Union([
          TryoutAttemptStateError,
          AuthFailure,
          TryoutResponseErrorWire,
          TryoutRuntimeErrorWire,
          TryoutResponseIntegrityError,
          TryoutResponseSelectionError,
          TryoutProgressError,
          TryoutProgressSizeError,
        ]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "flag",
      args: () => tryoutFlagArgsValidator.fields,
      returns: () => Schema.Null,
      error: () =>
        Schema.Union([
          TryoutAttemptStateError,
          AuthFailure,
          TryoutResponseErrorWire,
          TryoutRuntimeErrorWire,
          TryoutResponseIntegrityError,
        ]),
    }).middleware(Session)
  );
