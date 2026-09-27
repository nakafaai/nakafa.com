import { FunctionSpec, GroupSpec } from "@confect/core";
import { ReleaseErrorWire } from "@repo/backend/confect/contentRelease/error";
import { TryoutAttemptStateErrorWire } from "@repo/backend/confect/tryouts/attempt";
import {
  tryoutSectionAttemptPageRequestValidator,
  tryoutSectionAttemptPageResultValidator,
  tryoutSetAttemptPageRequestValidator,
  tryoutSetAttemptPageResultValidator,
} from "@repo/backend/confect/tryouts/attemptPage/spec";
import { TryoutAuthFailure } from "@repo/backend/confect/tryouts/auth";
import {
  TryoutResponseIntegrityErrorWire,
  TryoutResponseSelectionErrorWire,
} from "@repo/backend/confect/tryouts/response/spec";
import { TryoutRuntimeErrorWire } from "@repo/backend/confect/tryouts/runtime/error";
import { TryoutSelectorReadErrorWire } from "@repo/backend/confect/tryouts/runtime/ownership";
import { TryoutScoreReadErrorWire } from "@repo/backend/confect/tryouts/score";
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
          TryoutAttemptStateErrorWire,
          TryoutAuthFailure,

          TryoutRuntimeErrorWire,
          TryoutScoreReadErrorWire,
          TryoutResponseIntegrityErrorWire,
          TryoutResponseSelectionErrorWire,
          TryoutSelectorReadErrorWire,
          ReleaseErrorWire,
        ]),
    })
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
          TryoutAttemptStateErrorWire,
          TryoutAuthFailure,

          TryoutRuntimeErrorWire,
          ReleaseErrorWire,
          TryoutScoreReadErrorWire,
          TryoutResponseIntegrityErrorWire,
          TryoutResponseSelectionErrorWire,
          TryoutSelectorReadErrorWire,
        ]),
    })
  );
