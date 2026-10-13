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
const SECTION_STARTED_RESULT = "started";

/** The one section of one attempt that a start or a finish targets. */
const sectionTargetValidator = Schema.Struct({
  attemptId: IdSchema("tryoutAttempts"),
  sectionKey: tryoutRouteKeyValidator,
});
export type SectionTarget = typeof sectionTargetValidator.Type;
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicMutation({
      name: "start",
      args: () => sectionTargetValidator.fields,
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
      args: () => sectionTargetValidator.fields,
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
