import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseErrorWire } from "@repo/backend/confect/contentRelease/error";
import { TryoutAttemptStateErrorWire } from "@repo/backend/confect/tryouts/attempt";
import { TryoutAuthFailure } from "@repo/backend/confect/tryouts/auth";
import { tryoutBodyBatchValidator } from "@repo/backend/confect/tryouts/runtime/body";
import { TryoutRuntimeErrorWire } from "@repo/backend/confect/tryouts/runtime/error";
import {
  TryoutHistoryErrorWire,
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
        TryoutAttemptStateErrorWire,
        TryoutAuthFailure,

        TryoutRuntimeErrorWire,
        TryoutHistoryErrorWire,
        TryoutSelectorReadErrorWire,
        ReleaseErrorWire,
      ]),
  })
);
