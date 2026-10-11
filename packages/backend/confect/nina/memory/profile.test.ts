import { Ref } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { createNinaTest } from "@repo/backend/test/nina";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";

const read = Ref.getFunctionReference(refs.internal.nina.memory.read);

describe("learner profile", () => {
  it("reads the account profile with the latest finished try-out by section", async () => {
    const f = await createNinaTest();
    const userId = await f.t.mutation(async (ctx) => {
      const runtime = await seedTryoutContentAccessState(ctx, {
        attemptStatus: "completed",
        sectionStatus: "completed",
        suffix: "memory-profile",
      });
      const { userId: owner } = runtime.identity;
      await ctx.db.insert("onboardingProfiles", {
        focus: "tryout",
        region: "indonesia",
        updatedAt: 1,
        userId: owner,
      });
      await ctx.db.insert("learningPreferences", {
        preferredTryoutCountryKey: "indonesia",
        updatedAt: 1,
        userId: owner,
      });
      const attempt = await ctx.db.get("tryoutAttempts", runtime.attemptId);
      if (!attempt) {
        return Promise.reject(new Error("Fixture attempt missing"));
      }
      await ctx.db.insert("tryoutScores", {
        finalizedAt: Date.UTC(2026, 8, 12),
        publishedScore: 612,
        rawScore: 1,
        scoreStatus: "provisional",
        scoringStrategy: "raw",
        setIdentity: attempt.setIdentity,
        totalCorrect: 1,
        totalQuestions: 1,
        tryoutAttemptId: attempt._id,
        tryoutSnapshotId: attempt.tryoutSnapshotId,
        userId: owner,
      });
      return owner;
    });
    expect(await f.t.query(read, { userId })).toEqual({
      known: [],
      paused: false,
      profile: {
        focus: "tryout",
        region: "indonesia",
        tryout: {
          correct: 1,
          exam: "snbt",
          finishedAt: Date.UTC(2026, 8, 12),
          score: 612,
          sections: [{ correct: 0, key: "penalaran-matematika", total: 1 }],
          set: "set-1",
          status: "provisional",
          total: 1,
        },
        tryoutCountry: "indonesia",
      },
      prompt: [],
    });
  });

  it("reads no try-out when the scored attempt is gone", async () => {
    const f = await createNinaTest();
    const userId = await f.t.mutation(async (ctx) => {
      const runtime = await seedTryoutContentAccessState(ctx, {
        attemptStatus: "completed",
        sectionStatus: "completed",
        suffix: "memory-orphan",
      });
      const attempt = await ctx.db.get("tryoutAttempts", runtime.attemptId);
      if (!attempt) {
        return Promise.reject(new Error("Fixture attempt missing"));
      }
      await ctx.db.insert("tryoutScores", {
        finalizedAt: 1,
        publishedScore: 500,
        rawScore: 1,
        scoreStatus: "official",
        scoringStrategy: "raw",
        setIdentity: attempt.setIdentity,
        totalCorrect: 1,
        totalQuestions: 1,
        tryoutAttemptId: attempt._id,
        tryoutSnapshotId: attempt.tryoutSnapshotId,
        userId: runtime.identity.userId,
      });
      await ctx.db.delete("tryoutAttempts", attempt._id);
      return runtime.identity.userId;
    });
    expect(await f.t.query(read, { userId })).toEqual({
      known: [],
      paused: false,
      profile: {},
      prompt: [],
    });
  });
});
