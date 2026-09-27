import { FunctionSpec, GroupSpec } from "@confect/core";
import { ProductAnalyticsCaptureErrorWire } from "@repo/backend/confect/analytics/capture.spec";
import { ConsentPersistenceErrorWire } from "@repo/backend/confect/consents/schema";
import { ReleaseErrorWire } from "@repo/backend/confect/contentRelease/error";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import { TryoutAttemptStateErrorWire } from "@repo/backend/confect/tryouts/attempt";
import { TryoutAuthFailure } from "@repo/backend/confect/tryouts/auth";
import {
  TryoutProgressErrorWire,
  TryoutProgressSizeErrorWire,
} from "@repo/backend/confect/tryouts/progress/spec";
import {
  TryoutResponseIntegrityErrorWire,
  TryoutResponseSelectionErrorWire,
} from "@repo/backend/confect/tryouts/response/spec";
import { TryoutRuntimeErrorWire } from "@repo/backend/confect/tryouts/runtime/error";
import {
  startAttemptArgsValidator,
  startAttemptResultValidator,
  TryoutStartErrorWire,
} from "@repo/backend/confect/tryouts/start/spec";
import { Schema } from "effect";
export default GroupSpec.make().addFunction(
  FunctionSpec.publicMutation({
    name: "startAttempt",
    args: () => startAttemptArgsValidator.fields,
    returns: () => startAttemptResultValidator,
    error: () =>
      Schema.Union([
        TryoutAttemptStateErrorWire,
        TryoutAuthFailure,

        TryoutStartErrorWire,
        TryoutRuntimeErrorWire,
        TryoutResponseIntegrityErrorWire,
        TryoutResponseSelectionErrorWire,
        TryoutProgressErrorWire,
        TryoutProgressSizeErrorWire,
        ReleaseErrorWire,
        ConsentPersistenceErrorWire,
        ProductAnalyticsCaptureErrorWire,
      ]),
  }).middleware(Atomic)
);
