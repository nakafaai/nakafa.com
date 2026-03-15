import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type { WithoutSystemFields } from "convex/server";

type ExerciseAttemptMutationCtx = Pick<MutationCtx, "db" | "scheduler">;

type CreateExerciseAttemptBase = Pick<
  WithoutSystemFields<Doc<"exerciseAttempts">>,
  | "exerciseNumber"
  | "mode"
  | "origin"
  | "perQuestionTimeLimit"
  | "scope"
  | "slug"
  | "startedAt"
  | "timeLimit"
  | "totalExercises"
  | "userId"
>;

type CreateExerciseAttemptArgs = Omit<CreateExerciseAttemptBase, "origin"> & {
  origin: NonNullable<CreateExerciseAttemptBase["origin"]>;
};

/**
 * Create a timed exercise attempt and schedule its expiry.
 *
 * Shared by standalone exercise flows and SNBT subject attempts so both use the
 * same lifecycle rules and durable scheduled expiry behavior.
 *
 * The input type is derived from the existing `exerciseAttempts` document shape
 * so helper callers stay aligned with schema changes instead of duplicating a
 * hand-written interface.
 */
export async function createExerciseAttempt(
  ctx: ExerciseAttemptMutationCtx,
  args: CreateExerciseAttemptArgs
) {
  const attemptId = await ctx.db.insert("exerciseAttempts", {
    slug: args.slug,
    userId: args.userId,
    origin: args.origin,
    mode: args.mode,
    scope: args.scope,
    exerciseNumber: args.scope === "single" ? args.exerciseNumber : undefined,
    timeLimit: args.timeLimit,
    perQuestionTimeLimit: args.perQuestionTimeLimit,
    startedAt: args.startedAt,
    lastActivityAt: args.startedAt,
    updatedAt: args.startedAt,
    status: "in-progress",
    totalExercises: args.totalExercises,
    answeredCount: 0,
    correctAnswers: 0,
    totalTime: 0,
    scorePercentage: 0,
  });

  const expiresAtMs = args.startedAt + args.timeLimit * 1000;
  const schedulerId = await ctx.scheduler.runAfter(
    args.timeLimit * 1000,
    internal.exercises.mutations.expireAttemptInternal,
    {
      attemptId,
      expiresAtMs,
    }
  );

  await ctx.db.patch("exerciseAttempts", attemptId, { schedulerId });

  return attemptId;
}
