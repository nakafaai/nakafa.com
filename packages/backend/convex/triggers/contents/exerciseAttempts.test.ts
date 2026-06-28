import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 3, 2, 12, 0, 0);

describe("triggers/contents/exerciseAttempts", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("captures exercise start and completion from the attempt lifecycle", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(
      async (ctx) => await seedAuthenticatedUser(ctx, { now: NOW })
    );
    const client = t.withIdentity({
      subject: identity.authUserId,
      sessionId: identity.sessionId,
    });

    const attemptId = await client.mutation(
      api.exercises.mutations.startAttempt,
      {
        mode: "practice",
        scope: "set",
        slug: "material/practice/assessment/snbt/set-1",
        timeLimit: 600,
        totalExercises: 10,
      }
    );

    await client.mutation(api.exercises.mutations.completeAttempt, {
      attemptId,
    });

    const scheduledJobs = await t.query(
      async (ctx) => await ctx.db.system.query("_scheduled_functions").collect()
    );

    expect(scheduledJobs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          args: [
            expect.objectContaining({
              distinctId: identity.userId,
              event: "exercise attempt started",
              properties: JSON.stringify({
                mode: "practice",
                origin: "standalone",
                scope: "set",
                slug: "material/practice/assessment/snbt/set-1",
                total_exercises: 10,
              }),
            }),
          ],
        }),
        expect.objectContaining({
          args: [
            expect.objectContaining({
              distinctId: identity.userId,
              event: "exercise attempt completed",
              properties: JSON.stringify({
                answered_count: 0,
                correct_answers: 0,
                mode: "practice",
                origin: "standalone",
                score_percentage: 0,
                scope: "set",
                slug: "material/practice/assessment/snbt/set-1",
                total_exercises: 10,
                total_time: 0,
              }),
            }),
          ],
        }),
      ])
    );
  });
});
