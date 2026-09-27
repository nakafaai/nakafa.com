import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
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
import { Schema } from "effect";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "attempt",
      args: () => ({
        attemptId: IdSchema("tryoutAttempts"),
        expiresAt: Schema.Finite,
      }),
      returns: () => Schema.Null,
      error: () =>
        Schema.Union([
          TryoutAttemptStateError,
          TryoutRuntimeErrorWire,
          TryoutResponseIntegrityError,
          TryoutResponseSelectionError,
          TryoutProgressError,
          TryoutProgressSizeError,
        ]),
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "section",
      args: () => ({
        expiresAt: Schema.Finite,
        sectionAttemptId: IdSchema("tryoutSectionAttempts"),
      }),
      returns: () => Schema.Null,
      error: () =>
        Schema.Union([
          TryoutAttemptStateError,
          TryoutRuntimeErrorWire,
          TryoutResponseIntegrityError,
          TryoutResponseSelectionError,
          TryoutProgressError,
          TryoutProgressSizeError,
        ]),
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "sweep",
      args: () => ({}),
      returns: () => Schema.Null,
      error: () => TryoutRuntimeErrorWire,
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "reconcileAttempts",
      args: () => ({
        before: Schema.Finite,
      }),
      returns: () => Schema.Null,
      error: () => TryoutRuntimeErrorWire,
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "reconcileSections",
      args: () => ({
        before: Schema.Finite,
        scheduledAttemptIds: Schema.mutable(
          Schema.Array(IdSchema("tryoutAttempts"))
        ),
      }),
      returns: () => Schema.Null,
      error: () => TryoutRuntimeErrorWire,
    }).middleware(Atomic)
  );
