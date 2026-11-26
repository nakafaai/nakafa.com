import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { ProductAnalyticsCaptureError } from "@repo/backend/confect/analytics/capture.spec";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
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
  TryoutResponseUnfitError,
} from "@repo/backend/confect/tryouts/response/spec";
import { TryoutRuntimeErrorWire } from "@repo/backend/confect/tryouts/runtime/error";
import { TryoutScoreReadError } from "@repo/backend/confect/tryouts/score";
import {
  startAttemptArgsValidator,
  startAttemptResultValidator,
  TryoutStartError,
} from "@repo/backend/confect/tryouts/start/spec";
import { Schema } from "effect";
export default GroupSpec.make()
  .addFunction(
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
          TryoutResponseUnfitError,
          TryoutProgressError,
          TryoutProgressSizeError,
          ReleaseError,
          ProductAnalyticsCaptureError,
        ]),
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "discardAttempt",
      args: () => ({ attemptId: IdSchema("tryoutAttempts") }),
      returns: () => Schema.Struct({ discarded: Schema.Literal(true) }),
      error: () =>
        Schema.Union([
          TryoutAttemptStateError,
          AuthFailure,
          TryoutRuntimeErrorWire,
          TryoutScoreReadError,
          TryoutProgressError,
          TryoutProgressSizeError,
        ]),
    })
      .middleware(Session)
      .middleware(Atomic)
  );
