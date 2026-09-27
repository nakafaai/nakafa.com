import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TryoutAttemptStateError } from "@repo/backend/confect/tryouts/attempt";
import {
  TryoutRouteErrorWire,
  tryoutSetIdentityValidator,
} from "@repo/backend/confect/tryouts/route";
import { TryoutRuntimeErrorWire } from "@repo/backend/confect/tryouts/runtime/error";
import {
  TryoutScoreReadError,
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
  FunctionSpec.publicPaginatedQuery({
    name: "bySet",
    args: () => ({
      ...tryoutSetIdentityValidator.fields,
    }),
    item: () => historyRowValidator,
    error: () =>
      Schema.Union([
        TryoutAttemptStateError,
        AuthFailure,
        TryoutRouteErrorWire,
        TryoutRuntimeErrorWire,
        TryoutScoreReadError,
      ]),
  }).middleware(Session)
);
