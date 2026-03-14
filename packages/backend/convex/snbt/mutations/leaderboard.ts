import { internalMutation } from "@repo/backend/convex/functions";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";

export const updateLeaderboard = internalMutation({
  args: {
    tryoutAttemptId: vv.id("snbtTryoutAttempts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tryoutAttempt = await ctx.db.get(
      "snbtTryoutAttempts",
      args.tryoutAttemptId
    );
    if (!tryoutAttempt || tryoutAttempt.status !== "completed") {
      return null;
    }

    const existingEntry = await ctx.db
      .query("snbtLeaderboard")
      .withIndex("tryoutId_userId", (q) =>
        q
          .eq("tryoutId", tryoutAttempt.tryoutId)
          .eq("userId", tryoutAttempt.userId)
      )
      .first();

    const completedAt = tryoutAttempt.completedAt ?? Date.now();
    const rawScore =
      tryoutAttempt.totalQuestions > 0
        ? (tryoutAttempt.totalCorrect / tryoutAttempt.totalQuestions) * 100
        : 0;

    const entryData = {
      tryoutId: tryoutAttempt.tryoutId,
      userId: tryoutAttempt.userId,
      theta: tryoutAttempt.theta,
      irtScore: tryoutAttempt.irtScore,
      rawScore,
      completedAt,
      attemptId: tryoutAttempt._id,
    };

    if (existingEntry) {
      if (tryoutAttempt.theta > existingEntry.theta) {
        await ctx.db.patch("snbtLeaderboard", existingEntry._id, entryData);
      }
    } else {
      await ctx.db.insert("snbtLeaderboard", entryData);
    }

    return null;
  },
});
