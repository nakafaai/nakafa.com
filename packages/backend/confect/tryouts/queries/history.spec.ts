import { FunctionSpec, GroupSpec } from "@confect/core";
import { PaginationOptions as PaginationOptionsSchema } from "@confect/core/PaginationOptions";
import { PaginationResult as PaginationResultSchema } from "@confect/core/PaginationResult";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { TryoutAttemptStateErrorWire } from "@repo/backend/confect/tryouts/attempt";
import { TryoutAuthFailure } from "@repo/backend/confect/tryouts/auth";
import {
  TryoutRouteErrorWire,
  tryoutSetIdentityValidator,
} from "@repo/backend/confect/tryouts/route";
import { TryoutRuntimeErrorWire } from "@repo/backend/confect/tryouts/runtime/error";
import {
  TryoutScoreReadErrorWire,
  tryoutScoreResultValidator,
} from "@repo/backend/confect/tryouts/score";
import { tryoutStatusValidator } from "@repo/backend/confect/tryouts/status";
import { Schema } from "effect";
export const historyRowValidator = Schema.Struct({
  attemptId: IdSchema("tryoutAttempts"),
  attemptNumber: Schema.Finite,
  completedAt: Schema.Union([Schema.Finite, Schema.Null]),
  score: Schema.Union([tryoutScoreResultValidator, Schema.Null]),
  startedAt: Schema.Finite,
  status: tryoutStatusValidator,
});

/** Loads and projects one bounded history page for the current app user. */
export default GroupSpec.make().addFunction(
  FunctionSpec.publicQuery({
    name: "bySet",
    args: () => ({
      paginationOpts: PaginationOptionsSchema,
      ...tryoutSetIdentityValidator.fields,
    }),
    returns: () => PaginationResultSchema(historyRowValidator),
    error: () =>
      Schema.Union([
        TryoutAttemptStateErrorWire,
        TryoutAuthFailure,

        TryoutRouteErrorWire,
        TryoutRuntimeErrorWire,
        TryoutScoreReadErrorWire,
      ]),
  })
);
