import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
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

const historyRowValidator = Schema.Struct({
  attemptId: IdSchema("tryoutAttempts"),
  attemptNumber: Schema.Finite,
  completedAt: Schema.Union([Schema.Finite, Schema.Null]),
  score: Schema.Union([tryoutScoreResultValidator, Schema.Null]),
  startedAt: Schema.Finite,
  status: tryoutStatusValidator,
});

/**
 * One try-out the learner sat, as the home lists it: its set by the title and
 * route of the active release, how its newest attempt stands, and that
 * attempt's published score once it has one.
 */
const recentRowValidator = Schema.Struct({
  attemptId: IdSchema("tryoutAttempts"),
  publicPath: Schema.String,
  score: Schema.Union([Schema.Finite, Schema.Null]),
  status: tryoutStatusValidator,
  title: Schema.String,
});

/** The learner's own try-out history: one set's attempts by page, and the sets sat last. */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "recent",
      args: () => ({}),
      returns: () => Schema.Array(recentRowValidator),
      error: () =>
        Schema.Union([
          AuthFailure,
          ReleaseError,
          TryoutRuntimeErrorWire,
          TryoutScoreReadError,
        ]),
    }).middleware(Session)
  )
  .addFunction(
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
