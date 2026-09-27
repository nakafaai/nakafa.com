import { FunctionSpec, GroupSpec } from "@confect/core";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TryoutAttemptStateError } from "@repo/backend/confect/tryouts/attempt";
import { tryoutBodyBatchValidator } from "@repo/backend/confect/tryouts/runtime/body";
import { TryoutRuntimeErrorWire } from "@repo/backend/confect/tryouts/runtime/error";
import {
  TryoutHistoryError,
  tryoutHistoryRequestValidator,
} from "@repo/backend/confect/tryouts/runtime/history/spec";
import { TryoutSelectorReadErrorWire } from "@repo/backend/confect/tryouts/runtime/ownership";
import { Schema } from "effect";
/** Delivers original signed bodies only to the authenticated attempt owner. */
export default GroupSpec.make().addFunction(
  FunctionSpec.publicQuery({
    name: "getBatch",
    args: () => tryoutHistoryRequestValidator.fields,
    returns: () => Schema.Union([Schema.Null, tryoutBodyBatchValidator]),
    error: () =>
      Schema.Union([
        TryoutAttemptStateError,
        AuthFailure,
        TryoutRuntimeErrorWire,
        TryoutHistoryError,
        TryoutSelectorReadErrorWire,
        ReleaseError,
      ]),
  }).middleware(Session)
);
