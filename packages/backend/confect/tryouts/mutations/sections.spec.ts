import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
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
import { tryoutRouteKeyValidator } from "@repo/backend/confect/tryouts/route";
import { TryoutRuntimeErrorWire } from "@repo/backend/confect/tryouts/runtime/error";
import { Schema } from "effect";
export const SECTION_COMPLETED_RESULT = "completed";
export const SECTION_STARTED_RESULT = "started";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicMutation({
      name: "start",
      args: () => ({
        attemptId: IdSchema("tryoutAttempts"),
        sectionKey: tryoutRouteKeyValidator,
      }),
      returns: () =>
        Schema.Struct({
          kind: Schema.Literal(SECTION_STARTED_RESULT),
        }),
      error: () =>
        Schema.Union([
          TryoutAttemptStateError,
          AuthFailure,
          TryoutRuntimeErrorWire,
          TryoutResponseIntegrityError,
          TryoutResponseSelectionError,
          TryoutProgressError,
          TryoutProgressSizeError,
        ]),
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "complete",
      args: () => ({
        attemptId: IdSchema("tryoutAttempts"),
        sectionKey: tryoutRouteKeyValidator,
      }),
      returns: () =>
        Schema.Struct({
          kind: Schema.Literal(SECTION_COMPLETED_RESULT),
        }),
      error: () =>
        Schema.Union([
          TryoutAttemptStateError,
          AuthFailure,
          TryoutRuntimeErrorWire,
          TryoutResponseIntegrityError,
          TryoutResponseSelectionError,
          TryoutProgressError,
          TryoutProgressSizeError,
        ]),
    })
      .middleware(Session)
      .middleware(Atomic)
  );
