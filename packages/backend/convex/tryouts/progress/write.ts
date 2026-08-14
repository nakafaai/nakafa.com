import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { ensureTryoutLifecycleWritable } from "@repo/backend/convex/contentRelease/cutover/tryouts";
import type { ConvexTaggedError } from "@repo/backend/convex/lib/effect";
import {
  getUnknownErrorMessage,
  readConvexErrorData,
} from "@repo/backend/convex/lib/effect";
import { ensureTryoutProgressWithinReadBudget } from "@repo/backend/convex/tryouts/progress/size";
import {
  getTryoutStatusRank,
  type TryoutStatus,
} from "@repo/backend/convex/tryouts/status";
import { Effect, Schema } from "effect";

type TryoutAttempt = Doc<"tryoutAttempts">;
type ProgressIdentity = Pick<
  TryoutAttempt,
  "countryKey" | "examKey" | "locale" | "setIdentity" | "setKey" | "trackKey"
>;

/** Expected failure while persisting compact try-out progress. */
export class TryoutProgressError
  extends Schema.TaggedError<TryoutProgressError>()("TryoutProgressError", {
    code: Schema.String,
    message: Schema.String,
  })
  implements ConvexTaggedError
{
  declare readonly code: string;
  declare readonly message: string;
}

/** Stores the latest compact attempt state used by set discovery queries. */
export const writeTryoutSetProgress = Effect.fn(
  "tryouts.progress.writeTryoutSetProgress"
)(function* (
  ctx: Pick<MutationCtx, "db">,
  args: {
    attempt: TryoutAttempt;
    publishedScore: number | null;
    status: TryoutStatus;
    updatedAt: number;
  }
) {
  yield* ensureTryoutLifecycleWritable(ctx).pipe(
    Effect.mapError(
      (error) =>
        new TryoutProgressError({
          code: error.code,
          message: error.message,
        })
    )
  );
  yield* validateProgressScore(args.status, args.publishedScore);
  const identity = readProgressIdentity(args.attempt);
  const current = yield* loadProgress(ctx, args.attempt, identity);
  if (current) {
    yield* ensureTryoutProgressWithinReadBudget(current);
  }

  if (current && current.attemptNumber > args.attempt.attemptNumber) {
    return current._id;
  }

  const values = {
    attemptNumber: args.attempt.attemptNumber,
    countryKey: identity.countryKey,
    examKey: identity.examKey,
    latestAttemptId: args.attempt._id,
    locale: identity.locale,
    publishedScore: args.publishedScore,
    setIdentity: identity.setIdentity,
    setKey: identity.setKey,
    status: args.status,
    statusRank: getTryoutStatusRank(args.status),
    trackKey: identity.trackKey,
    updatedAt: args.updatedAt,
    userId: args.attempt.userId,
  };

  if (current) {
    yield* ensureTryoutProgressWithinReadBudget({ ...current, ...values });
    yield* tryProgressPromise(() => ctx.db.patch(current._id, values));
    return current._id;
  }

  yield* ensureTryoutProgressWithinReadBudget(values);
  return yield* tryProgressPromise(() =>
    ctx.db.insert("tryoutSetProgress", values)
  );
});

/** Reads progress identity from the immutable signed attempt snapshot. */
function readProgressIdentity(attempt: TryoutAttempt): ProgressIdentity {
  return {
    countryKey: attempt.countryKey,
    examKey: attempt.examKey,
    locale: attempt.locale,
    setIdentity: attempt.setIdentity,
    setKey: attempt.setKey,
    trackKey: attempt.trackKey,
  };
}

/** Loads the one compact progress row owned by the attempt identity. */
const loadProgress = Effect.fn("tryouts.progress.loadProgress")(function* (
  ctx: Pick<MutationCtx, "db">,
  attempt: TryoutAttempt,
  identity: ProgressIdentity
) {
  return yield* tryProgressPromise(() =>
    ctx.db
      .query("tryoutSetProgress")
      .withIndex("by_userId_and_setIdentity", (query) =>
        query
          .eq("userId", attempt.userId)
          .eq("setIdentity", identity.setIdentity)
      )
      .unique()
  );
});

/** Enforces that only terminal progress can expose a persisted score. */
const validateProgressScore = Effect.fn(
  "tryouts.progress.validateProgressScore"
)(function* (status: TryoutStatus, publishedScore: number | null) {
  if (status === "in-progress" && publishedScore !== null) {
    return yield* new TryoutProgressError({
      code: "TRYOUT_ACTIVE_PROGRESS_HAS_SCORE",
      message: "Active try-out progress cannot expose a score.",
    });
  }

  if (status !== "in-progress" && publishedScore === null) {
    return yield* new TryoutProgressError({
      code: "TRYOUT_TERMINAL_PROGRESS_SCORE_REQUIRED",
      message: "Terminal try-out progress requires a score.",
    });
  }
});

/** Maps one thrown database failure into the progress error channel. */
export function toTryoutProgressError(error: unknown) {
  if (error instanceof TryoutProgressError) {
    return error;
  }

  const data = readConvexErrorData(error);
  if (data) {
    return new TryoutProgressError(data);
  }

  return new TryoutProgressError({
    code: "TRYOUT_PROGRESS_WRITE_FAILED",
    message: getUnknownErrorMessage(error),
  });
}

/** Lifts one Convex database operation into the progress error channel. */
function tryProgressPromise<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({ catch: toTryoutProgressError, try: operation });
}
