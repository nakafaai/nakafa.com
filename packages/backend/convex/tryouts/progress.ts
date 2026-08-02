import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type {
  TryoutStatus,
  TryoutStatusRank,
} from "@repo/backend/convex/tryouts/status";
import { ConvexError } from "convex/values";

type TryoutAttempt = Doc<"tryoutAttempts">;
type ProgressIdentity = Pick<
  Doc<"tryoutSetProgress">,
  "countryKey" | "examKey" | "locale" | "setKey" | "trackKey"
> &
  Pick<TryoutAttempt, "setIdentity" | "tryoutSetId">;

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
export async function writeTryoutSetProgress(
  ctx: Pick<MutationCtx, "db">,
  args: {
    attempt: TryoutAttempt;
    publishedScore: number | null;
    status: TryoutStatus;
    updatedAt: number;
  }
) {
  assertProgressScore(args.status, args.publishedScore);
  const identity = await resolveProgressIdentity(ctx, args.attempt);
  const current = await loadProgress(ctx, args.attempt, identity);

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
    await ctx.db.patch(current._id, values);
    return current._id;
  }

  return await ctx.db.insert("tryoutSetProgress", values);
}

/** Resolves progress identity from the immutable attempt before any live source. */
async function resolveProgressIdentity(
  ctx: Pick<MutationCtx, "db">,
  attempt: TryoutAttempt
): Promise<ProgressIdentity> {
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

  if (!attempt.tryoutSetId) {
    throw new ConvexError({
      code: "TRYOUT_PROGRESS_IDENTITY_REQUIRED",
      message: "Try-out progress has no stable set identity.",
    });
  }

  const set = await ctx.db.get(attempt.tryoutSetId);
  if (!set) {
    throw new ConvexError({
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
}

/** Loads the one compact progress row owned by the attempt identity. */
function loadProgress(
  ctx: Pick<MutationCtx, "db">,
  attempt: TryoutAttempt,
  identity: ProgressIdentity
) {
  if (identity.setIdentity) {
    return ctx.db
      .query("tryoutSetProgress")
      .withIndex("by_userId_and_setIdentity", (query) =>
        query
          .eq("userId", attempt.userId)
          .eq("setIdentity", identity.setIdentity)
      )
      .unique();
  }

  if (!identity.tryoutSetId) {
    throw new ConvexError({
      code: "TRYOUT_PROGRESS_IDENTITY_REQUIRED",
      message: "Try-out progress has no stable set identity.",
    });
  }

  return ctx.db
    .query("tryoutSetProgress")
    .withIndex("by_userId_and_tryoutSetId", (query) =>
      query.eq("userId", attempt.userId).eq("tryoutSetId", identity.tryoutSetId)
    )
    .unique();
}

/** Enforces that only terminal progress can expose a persisted score. */
function assertProgressScore(
  status: TryoutStatus,
  publishedScore: number | null
) {
  if (status === "in-progress" && publishedScore !== null) {
    throw new ConvexError({
      code: "TRYOUT_ACTIVE_PROGRESS_HAS_SCORE",
      message: "Active try-out progress cannot expose a score.",
    });
  }

  if (status !== "in-progress" && publishedScore === null) {
    throw new ConvexError({
      code: "TRYOUT_TERMINAL_PROGRESS_SCORE_REQUIRED",
      message: "Terminal try-out progress requires a score.",
    });
  }
}
