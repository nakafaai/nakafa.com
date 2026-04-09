import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
import { loadPartStartContext } from "@repo/backend/convex/tryouts/helpers/attemptLifecycle";
import {
  ATTEMPT_WINDOW_MS,
  createTryoutTestConvex,
  insertTryoutSkeleton,
  NOW,
} from "@repo/backend/convex/tryouts/test.helpers";
import { describe, expect, it } from "vitest";

describe("tryouts/helpers/attemptLifecycle", () => {
  it("loads part start context from the requested current route while preserving snapshot set data", async () => {
    const t = createTryoutTestConvex();

    const result = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "part-start-snapshot",
      });
      const tryout = await insertTryoutSkeleton(ctx, "part-start-snapshot");
      const replacementSetId = await ctx.db.insert("exerciseSets", {
        locale: "id",
        slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/part-start-replacement",
        category: "high-school",
        type: "snbt",
        material: "quantitative-knowledge",
        exerciseType: "try-out",
        setName: "part-start-replacement",
        title: "Replacement Set",
        questionCount: 30,
        syncedAt: NOW,
      });
      const tryoutPartSet = await ctx.db
        .query("tryoutPartSets")
        .withIndex("by_tryoutId_and_partIndex", (q) =>
          q.eq("tryoutId", tryout.tryoutId)
        )
        .unique();

      if (!tryoutPartSet) {
        throw new Error("Expected tryout part set to exist");
      }

      const tryoutAttemptId = await ctx.db.insert("tryoutAttempts", {
        userId: identity.userId,
        tryoutId: tryout.tryoutId,
        scaleVersionId: tryout.scaleVersionId,
        scoreStatus: "official",
        status: "in-progress",
        partSetSnapshots: [
          {
            partIndex: 0,
            partKey: "quantitative-knowledge",
            questionCount: 20,
            setId: tryout.setId,
          },
        ],
        completedPartIndices: [],
        attemptNumber: 1,
        totalCorrect: 0,
        totalQuestions: 0,
        theta: 0,
        thetaSE: 1,
        startedAt: NOW,
        expiresAt: NOW + ATTEMPT_WINDOW_MS,
        lastActivityAt: NOW,
        completedAt: null,
        endReason: null,
      });

      await ctx.db.patch("tryoutPartSets", tryoutPartSet._id, {
        partKey: "mathematical-reasoning",
        setId: replacementSetId,
      });

      return {
        context: await loadPartStartContext(ctx, {
          now: NOW,
          partKey: "mathematical-reasoning",
          tryoutAttemptId,
          userId: identity.userId,
        }),
        originalSetId: tryout.setId,
      };
    });

    expect(result.context.tryoutPartSnapshot).toEqual({
      partIndex: 0,
      partKey: "quantitative-knowledge",
      setId: expect.any(String),
      questionCount: 20,
    });
    expect(result.context.tryoutPartSnapshot.setId).toBe(result.originalSetId);
  });
});
