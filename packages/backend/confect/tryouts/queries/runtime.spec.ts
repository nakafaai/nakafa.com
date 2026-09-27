import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { TryoutAttemptStateErrorWire } from "@repo/backend/confect/tryouts/attempt";
import { TryoutAuthFailure } from "@repo/backend/confect/tryouts/auth";
import {
  TryoutResponseIntegrityErrorWire,
  TryoutResponseSelectionErrorWire,
} from "@repo/backend/confect/tryouts/response/spec";
import { tryoutRouteKeyValidator } from "@repo/backend/confect/tryouts/route";
import { TryoutRuntimeErrorWire } from "@repo/backend/confect/tryouts/runtime/error";
import { TryoutSelectorReadErrorWire } from "@repo/backend/confect/tryouts/runtime/ownership";
import { tryoutRuntimeStateValidator } from "@repo/backend/confect/tryouts/runtime/spec";
import { TryoutScoreReadErrorWire } from "@repo/backend/confect/tryouts/score";
import { Schema } from "effect";
/** Loads compact mutable set state through one exact owned attempt ID. */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getSetAttemptState",
      args: () => ({
        attemptId: IdSchema("tryoutAttempts"),
      }),
      returns: () => Schema.Union([Schema.Null, tryoutRuntimeStateValidator]),
      error: () =>
        Schema.Union([
          TryoutAttemptStateErrorWire,
          TryoutAuthFailure,

          TryoutRuntimeErrorWire,
          TryoutScoreReadErrorWire,
          TryoutResponseIntegrityErrorWire,
          TryoutResponseSelectionErrorWire,
          TryoutSelectorReadErrorWire,
        ]),
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getSectionAttemptState",
      args: () => ({
        attemptId: IdSchema("tryoutAttempts"),
        sectionKey: tryoutRouteKeyValidator,
      }),
      returns: () => Schema.Union([Schema.Null, tryoutRuntimeStateValidator]),
      error: () =>
        Schema.Union([
          TryoutAttemptStateErrorWire,
          TryoutAuthFailure,

          TryoutRuntimeErrorWire,
          TryoutScoreReadErrorWire,
          TryoutResponseIntegrityErrorWire,
          TryoutResponseSelectionErrorWire,
          TryoutSelectorReadErrorWire,
        ]),
    })
  );
