import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
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
          TryoutAttemptStateErrorWire,
          TryoutAuthFailure,

          TryoutRuntimeErrorWire,
          TryoutResponseIntegrityErrorWire,
          TryoutResponseSelectionErrorWire,
          TryoutProgressErrorWire,
          TryoutProgressSizeErrorWire,
        ]),
    }).middleware(Atomic)
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
          TryoutAttemptStateErrorWire,
          TryoutAuthFailure,

          TryoutRuntimeErrorWire,
          TryoutResponseIntegrityErrorWire,
          TryoutResponseSelectionErrorWire,
          TryoutProgressErrorWire,
          TryoutProgressSizeErrorWire,
        ]),
    }).middleware(Atomic)
  );
