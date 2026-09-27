import { FunctionSpec, GroupSpec } from "@confect/core";
import { ProductAnalyticsCaptureError } from "@repo/backend/confect/analytics/capture.spec";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ConsentPersistenceError } from "@repo/backend/confect/consents/schema";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TryoutAttemptStateError } from "@repo/backend/confect/tryouts/attempt";
import {
  TryoutProgressError,
  TryoutProgressSizeError,
} from "@repo/backend/confect/tryouts/progress/spec";
import {
  TryoutResponseIntegrityError,
  TryoutResponseSelectionError,
} from "@repo/backend/confect/tryouts/response/spec";
import { TryoutRuntimeErrorWire } from "@repo/backend/confect/tryouts/runtime/error";
import {
  startAttemptArgsValidator,
  startAttemptResultValidator,
  TryoutStartError,
} from "@repo/backend/confect/tryouts/start/spec";
import { Schema } from "effect";
export default GroupSpec.make().addFunction(
  FunctionSpec.publicMutation({
    name: "startAttempt",
    args: () => startAttemptArgsValidator.fields,
    returns: () => startAttemptResultValidator,
    error: () =>
      Schema.Union([
        TryoutAttemptStateError,
        AuthFailure,
        TryoutStartError,
        TryoutRuntimeErrorWire,
        TryoutResponseIntegrityError,
        TryoutResponseSelectionError,
        TryoutProgressError,
        TryoutProgressSizeError,
        ReleaseError,
        ConsentPersistenceError,
        ProductAnalyticsCaptureError,
      ]),
  })
    .middleware(Session)
    .middleware(Atomic)
);
