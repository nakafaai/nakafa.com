import { assert, describe, expect, it } from "@effect/vitest";
import { seedAuthenticatedUser } from "@repo/backend/confect/test.helpers";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { createNinaTest } from "@repo/backend/test/nina";
import { readLearner } from "@repo/backend/test/nina/memory";
import { activateAssessmentTestSnapshot } from "@repo/backend/test/snapshot/assessment";
import {
  insertStartedAttempt,
  TRYOUT_NOW,
} from "@repo/backend/test/tryout/world";

/** The time the turn reads at. These learners keep no memory, so it changes nothing. */
const NOW = Date.UTC(2026, 9, 10, 12);

/** Marks an attempt and its running entry section finished, without scoring them. */
async function finishAttempt(
  ctx: MutationCtx,
  attemptId: Id<"tryoutAttempts">
) {
  const attempt = await ctx.db.get("tryoutAttempts", attemptId);
  assert.ok(attempt, "Expected the started attempt.");
  const completedAt = attempt.startedAt + 1;
  await ctx.db.patch("tryoutAttempts", attemptId, {
    completedAt,
    endReason: "submitted",
    status: "completed",
  });
  for (const section of await ctx.db
    .query("tryoutSectionAttempts")
    .withIndex("by_tryoutAttemptId_and_sectionOrder", (query) =>
      query.eq("tryoutAttemptId", attemptId)
    )
    .collect()) {
    await ctx.db.patch("tryoutSectionAttempts", section._id, {
      completedAt,
      endReason: "submitted",
      status: "completed",
    });
  }
}

describe("learner profile", () => {
  it("reads the account profile with the latest finished try-out by section", async () => {
    const f = await createNinaTest();
    const userId = await f.t.mutation(async (ctx) => {
      await activateAssessmentTestSnapshot(ctx, { entry: true });
      const { userId: owner } = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_NOW,
        suffix: "memory-profile",
      });
      const attemptId = await insertStartedAttempt(ctx, owner, { entry: true });
      await finishAttempt(ctx, attemptId);
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
      const attempt = await ctx.db.get("tryoutAttempts", attemptId);
      if (!attempt) {
        return Promise.reject(new Error("Fixture attempt missing"));
      }
      await ctx.db.insert("tryoutScores", {
        assessmentSnapshotId: attempt.assessmentSnapshotId,
        finalizedAt: Date.UTC(2026, 8, 12),
        publishedScore: 612,
        rawScore: 1,
        scoreStatus: "provisional",
        scoringStrategy: "raw",
        setIdentity: attempt.setIdentity,
        totalCorrect: 1,
        totalQuestions: 2,
        tryoutAttemptId: attempt._id,
        userId: owner,
      });
      return owner;
    });
    expect(
      await readLearner(f, { now: NOW, said: "", topics: [], userId })
    ).toEqual({
      paused: false,
      profile: {
        focus: "tryout",
        region: "indonesia",
        tryout: {
          correct: 1,
          exam: "snbt",
          finishedAt: Date.UTC(2026, 8, 12),
          score: 612,
          sections: [{ correct: 0, key: "section-a", total: 2 }],
          set: "set-1",
          status: "provisional",
          total: 2,
        },
        tryoutCountry: "indonesia",
      },
      recalled: [],
    });
  });

  it("reads no try-out when the scored attempt is gone", async () => {
    const f = await createNinaTest();
    const userId = await f.t.mutation(async (ctx) => {
      await activateAssessmentTestSnapshot(ctx, { entry: true });
      const { userId: owner } = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_NOW,
        suffix: "memory-orphan",
      });
      const attemptId = await insertStartedAttempt(ctx, owner, { entry: true });
      await finishAttempt(ctx, attemptId);
      const attempt = await ctx.db.get("tryoutAttempts", attemptId);
      if (!attempt) {
        return Promise.reject(new Error("Fixture attempt missing"));
      }
      await ctx.db.insert("tryoutScores", {
        assessmentSnapshotId: attempt.assessmentSnapshotId,
        finalizedAt: 1,
        publishedScore: 500,
        rawScore: 1,
        scoreStatus: "official",
        scoringStrategy: "raw",
        setIdentity: attempt.setIdentity,
        totalCorrect: 1,
        totalQuestions: 2,
        tryoutAttemptId: attempt._id,
        userId: owner,
      });
      await ctx.db.delete("tryoutAttempts", attempt._id);
      return owner;
    });
    expect(
      await readLearner(f, { now: NOW, said: "", topics: [], userId })
    ).toEqual({
      paused: false,
      profile: {},
      recalled: [],
    });
  });
});
