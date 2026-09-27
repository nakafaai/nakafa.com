import { FunctionSpec, GroupSpec } from "@confect/core";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TryoutAttemptStateError } from "@repo/backend/confect/tryouts/attempt";
import {
  tryoutSectionAttemptPageRequestValidator,
  tryoutSectionAttemptPageResultValidator,
  tryoutSetAttemptPageRequestValidator,
  tryoutSetAttemptPageResultValidator,
} from "@repo/backend/confect/tryouts/attemptPage/spec";
import {
  TryoutResponseIntegrityError,
  TryoutResponseSelectionError,
} from "@repo/backend/confect/tryouts/response/spec";
import { TryoutRuntimeErrorWire } from "@repo/backend/confect/tryouts/runtime/error";
import { TryoutSelectorReadErrorWire } from "@repo/backend/confect/tryouts/runtime/ownership";
import { TryoutScoreReadError } from "@repo/backend/confect/tryouts/score";
import { Schema } from "effect";

/** Fetches one current set overlay or exact frozen set page. */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getSet",
      args: () => ({
        request: tryoutSetAttemptPageRequestValidator,
      }),
      returns: () => tryoutSetAttemptPageResultValidator,
      error: () =>
        Schema.Union([
          TryoutAttemptStateError,
          AuthFailure,
          TryoutRuntimeErrorWire,
          TryoutScoreReadError,
          TryoutResponseIntegrityError,
          TryoutResponseSelectionError,
          TryoutSelectorReadErrorWire,
          ReleaseError,
        ]),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getSection",
      args: () => ({
        request: tryoutSectionAttemptPageRequestValidator,
      }),
      returns: () => tryoutSectionAttemptPageResultValidator,
      error: () =>
        Schema.Union([
          TryoutAttemptStateError,
          AuthFailure,
          TryoutRuntimeErrorWire,
          ReleaseError,
          TryoutScoreReadError,
          TryoutResponseIntegrityError,
          TryoutResponseSelectionError,
          TryoutSelectorReadErrorWire,
        ]),
    }).middleware(Session)
  );
