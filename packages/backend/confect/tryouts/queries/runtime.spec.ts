import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TryoutAttemptStateError } from "@repo/backend/confect/tryouts/attempt";
import {
  TryoutResponseIntegrityError,
  TryoutResponseSelectionError,
} from "@repo/backend/confect/tryouts/response/spec";
import { tryoutRouteKeyValidator } from "@repo/backend/confect/tryouts/route";
import { TryoutRuntimeErrorWire } from "@repo/backend/confect/tryouts/runtime/error";
import { TryoutSelectorReadErrorWire } from "@repo/backend/confect/tryouts/runtime/ownership";
import { tryoutRuntimeStateValidator } from "@repo/backend/confect/tryouts/runtime/spec";
import { TryoutScoreReadError } from "@repo/backend/confect/tryouts/score";
import { Schema } from "effect";
/** Loads compact mutable set state through one exact owned attempt ID. */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getSetAttemptState",
      args: () => ({
        attemptId: IdSchema("tryoutAttempts"),
        locale: appLocaleValidator,
      }),
      returns: () => Schema.Union([Schema.Null, tryoutRuntimeStateValidator]),
      error: () =>
        Schema.Union([
          TryoutAttemptStateError,
          AuthFailure,
          TryoutRuntimeErrorWire,
          TryoutScoreReadError,
          TryoutResponseIntegrityError,
          TryoutResponseSelectionError,
          TryoutSelectorReadErrorWire,
        ]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getSectionAttemptState",
      args: () => ({
        attemptId: IdSchema("tryoutAttempts"),
        locale: appLocaleValidator,
        sectionKey: tryoutRouteKeyValidator,
      }),
      returns: () => Schema.Union([Schema.Null, tryoutRuntimeStateValidator]),
      error: () =>
        Schema.Union([
          TryoutAttemptStateError,
          AuthFailure,
          TryoutRuntimeErrorWire,
          TryoutScoreReadError,
          TryoutResponseIntegrityError,
          TryoutResponseSelectionError,
          TryoutSelectorReadErrorWire,
        ]),
    }).middleware(Session)
  );
