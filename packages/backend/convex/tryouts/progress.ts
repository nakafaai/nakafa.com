import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type {
  TryoutStatus,
  TryoutStatusRank,
} from "@repo/backend/convex/tryouts/schema";
import { hasStableAttemptSet } from "@repo/backend/convex/tryouts/snapshot/catalog";
import { ConvexError } from "convex/values";

type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutSet = Doc<"tryoutSets">;

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
    set: TryoutSet;
    status: TryoutStatus;
    updatedAt: number;
  }
) {
  assertProgressScore(args.status, args.publishedScore);
  if (!hasStableAttemptSet(args.attempt, args.set)) {
    throw new ConvexError({
      code: "TRYOUT_PROGRESS_IDENTITY_REQUIRED",
      message:
        "Try-out progress requires a complete signed attempt set identity.",
    });
  }

  const current = await ctx.db
    .query("tryoutSetProgress")
    .withIndex("by_userId_and_setIdentity", (q) =>
      q
        .eq("userId", args.attempt.userId)
        .eq("setIdentity", args.attempt.setIdentity)
    )
    .unique();

  if (current && current.attemptNumber > args.attempt.attemptNumber) {
    return current._id;
  }

  const values = {
    attemptNumber: args.attempt.attemptNumber,
    countryKey: args.attempt.countryKey,
    examKey: args.attempt.examKey,
    latestAttemptId: args.attempt._id,
    locale: args.attempt.locale,
    publishedScore: args.publishedScore,
    setIdentity: args.attempt.setIdentity,
    setKey: args.attempt.setKey,
    status: args.status,
    statusRank: getTryoutStatusRank(args.status),
    trackKey: args.attempt.trackKey,
    tryoutSetId: args.set._id,
    updatedAt: args.updatedAt,
    userId: args.attempt.userId,
  };

  if (current) {
    await ctx.db.patch(current._id, values);
    return current._id;
  }

  return await ctx.db.insert("tryoutSetProgress", values);
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
