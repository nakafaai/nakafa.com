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
 * One try-out the learner sat, as the home shows it: its set by the titles of its track and itself, its
 * country's flag code and its exam's key for its picture, the part to go on with while it runs, how its
 * newest attempt stands, its time, its answered and right questions out of all of them, and its
 * published score once it has one.
 */
const recentRowValidator = Schema.Struct({
  answered: Schema.Finite,
  attemptId: IdSchema("tryoutAttempts"),
  correct: Schema.Finite,
  countryCode: Schema.String,
  examKey: Schema.String,
  expiresAt: Schema.Finite,
  part: Schema.Union([
    Schema.Struct({ key: Schema.String, title: Schema.String }),
    Schema.Null,
  ]),
  publicPath: Schema.String,
  questions: Schema.Finite,
  score: Schema.Union([Schema.Finite, Schema.Null]),
  startedAt: Schema.Finite,
  status: tryoutStatusValidator,
  title: Schema.String,
  track: Schema.String,
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
