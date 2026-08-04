import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type { ConvexTaggedError } from "@repo/backend/convex/lib/effect";
import {
  getUnknownErrorMessage,
  readConvexErrorData,
} from "@repo/backend/convex/lib/effect";
import { ensureTryoutProgressWithinReadBudget } from "@repo/backend/convex/tryouts/progress/size";
import type {
  TryoutStatus,
  TryoutStatusRank,
} from "@repo/backend/convex/tryouts/status";
import { Effect, Schema } from "effect";

type TryoutAttempt = Doc<"tryoutAttempts">;
type ProgressIdentity = Pick<
  Doc<"tryoutSetProgress">,
  "countryKey" | "examKey" | "locale" | "setKey" | "trackKey"
> &
  Pick<TryoutAttempt, "setIdentity" | "tryoutSetId">;

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

/** Returns the stable workflow rank used by the progress sorting index. */
export function getTryoutStatusRank(status: TryoutStatus): TryoutStatusRank {
  if (status === "in-progress") {
    return 1;
  }

  if (status === "completed") {
    return 2;
  }

  return 3;
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
  yield* validateProgressScore(args.status, args.publishedScore);
  const identity = yield* resolveProgressIdentity(ctx, args.attempt);
  const current = yield* loadProgress(ctx, args.attempt, identity);
  if (current) {
    yield* ensureTryoutProgressWithinReadBudget(current);
  }

  if (current && current.attemptNumber > args.attempt.attemptNumber) {
    yield* persistProgressIdentity(ctx, current, identity);
    return current._id;
  }

  const values = {
    attemptNumber: args.attempt.attemptNumber,
    countryKey: identity.countryKey,
    examKey: identity.examKey,
    latestAttemptId: args.attempt._id,
    locale: identity.locale,
    publishedScore: args.publishedScore,
    ...(identity.setIdentity ? { setIdentity: identity.setIdentity } : {}),
    setKey: identity.setKey,
    status: args.status,
    statusRank: getTryoutStatusRank(args.status),
    trackKey: identity.trackKey,
    ...(identity.tryoutSetId ? { tryoutSetId: identity.tryoutSetId } : {}),
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

/** Resolves progress identity from the immutable attempt before any live source. */
const resolveProgressIdentity = Effect.fn(
  "tryouts.progress.resolveProgressIdentity"
)(function* (ctx: Pick<MutationCtx, "db">, attempt: TryoutAttempt) {
  if (
    attempt.countryKey &&
    attempt.examKey &&
    attempt.locale &&
    attempt.setKey &&
    attempt.trackKey
  ) {
    return {
      countryKey: attempt.countryKey,
      examKey: attempt.examKey,
      locale: attempt.locale,
      setIdentity: attempt.setIdentity,
      setKey: attempt.setKey,
      trackKey: attempt.trackKey,
      tryoutSetId: attempt.tryoutSetId,
    };
  }

  const tryoutSetId = attempt.tryoutSetId;
  if (!tryoutSetId) {
    return yield* new TryoutProgressError({
      code: "TRYOUT_PROGRESS_IDENTITY_REQUIRED",
      message: "Try-out progress has no stable set identity.",
    });
  }

  const set = yield* tryProgressPromise(() => ctx.db.get(tryoutSetId));
  if (!set) {
    return yield* new TryoutProgressError({
      code: "TRYOUT_SET_NOT_FOUND",
      message: "Try-out set not found.",
    });
  }

  return {
    countryKey: set.countryKey,
    examKey: set.examKey,
    locale: set.locale,
    setIdentity: attempt.setIdentity,
    setKey: set.setKey,
    trackKey: set.trackKey,
    tryoutSetId: set._id,
  };
});

/** Loads the one compact progress row owned by the attempt identity. */
const loadProgress = Effect.fn("tryouts.progress.loadProgress")(function* (
  ctx: Pick<MutationCtx, "db">,
  attempt: TryoutAttempt,
  identity: ProgressIdentity
) {
  let signed: Doc<"tryoutSetProgress"> | null = null;
  if (identity.setIdentity) {
    signed = yield* tryProgressPromise(() =>
      ctx.db
        .query("tryoutSetProgress")
        .withIndex("by_userId_and_setIdentity", (query) =>
          query
            .eq("userId", attempt.userId)
            .eq("setIdentity", identity.setIdentity)
        )
        .unique()
    );
  }

  let filesystem: Doc<"tryoutSetProgress"> | null = null;
  if (identity.tryoutSetId) {
    filesystem = yield* tryProgressPromise(() =>
      ctx.db
        .query("tryoutSetProgress")
        .withIndex("by_userId_and_tryoutSetId", (query) =>
          query
            .eq("userId", attempt.userId)
            .eq("tryoutSetId", identity.tryoutSetId)
        )
        .unique()
    );
  }

  if (signed && filesystem && signed._id !== filesystem._id) {
    return yield* new TryoutProgressError({
      code: "TRYOUT_PROGRESS_CONFLICT",
      message: "Try-out progress has conflicting set identities.",
    });
  }

  if (!(identity.setIdentity || identity.tryoutSetId)) {
    return yield* new TryoutProgressError({
      code: "TRYOUT_PROGRESS_IDENTITY_REQUIRED",
      message: "Try-out progress has no stable set identity.",
    });
  }

  return signed ?? filesystem;
});

/** Backfills missing identity keys without replacing newer progress state. */
const persistProgressIdentity = Effect.fn(
  "tryouts.progress.persistProgressIdentity"
)(function* (
  ctx: Pick<MutationCtx, "db">,
  current: Doc<"tryoutSetProgress">,
  identity: ProgressIdentity
) {
  const setIdentity = identity.setIdentity;
  const tryoutSetId = identity.tryoutSetId;
  const needsSignedIdentity = setIdentity && !current.setIdentity;
  const needsFilesystemIdentity = tryoutSetId && !current.tryoutSetId;

  if (!(needsSignedIdentity || needsFilesystemIdentity)) {
    return;
  }

  const patch = {
    ...(needsSignedIdentity ? { setIdentity } : {}),
    ...(needsFilesystemIdentity ? { tryoutSetId } : {}),
  };
  yield* ensureTryoutProgressWithinReadBudget({ ...current, ...patch });
  yield* tryProgressPromise(() => ctx.db.patch(current._id, patch));
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
