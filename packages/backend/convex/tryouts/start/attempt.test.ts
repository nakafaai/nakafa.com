import { describe, expect, it } from "@effect/vitest";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { createTryoutAttempt } from "@repo/backend/convex/tryouts/start/attempt";
import { loadTryoutStartSource } from "@repo/backend/convex/tryouts/start/source";
import {
  TRYOUT_START_NOW as NOW,
  TRYOUT_START_COUNTRY,
  TRYOUT_START_EXAM,
  TRYOUT_START_SET,
  TRYOUT_START_TRACK,
} from "@repo/backend/test/tryout/source";
import { seedTryoutStartSet } from "@repo/backend/test/tryout/start";

describe("tryouts/start/attempt", () => {
  it("rolls back the new attempt if its progress row cannot be written", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "start-progress-failure",
      });
      await seedTryoutStartSet(ctx, {
        userId: user.userId,
        visibility: "visible",
      });
      return user;
    });
    await expect(
      t.mutation(async (ctx) => {
        const args = {
          countryKey: TRYOUT_START_COUNTRY,
          examKey: TRYOUT_START_EXAM,
          locale: "id" as const,
          setKey: TRYOUT_START_SET,
          trackKey: TRYOUT_START_TRACK,
        };
        const source = await runConvexProgram(loadTryoutStartSource(ctx, args));
        vi.spyOn(ctx.db, "query").mockImplementationOnce(() => {
          throw new Error("Progress storage unavailable.");
        });
        return runConvexProgram(
          createTryoutAttempt(ctx, {
            access: {
              accessEndsAt: NOW + 60_000,
              accessSourceKind: "free",
              countsForCompetition: false,
            },
            args,
            attemptNumber: 1,
            now: NOW,
            scaleVersion: null,
            source,
            userId: identity.userId,
          })
        );
      })
    ).rejects.toMatchObject({
      data: {
        code: "TRYOUT_PROGRESS_WRITE_FAILED",
        message: "Progress storage unavailable.",
      },
    });
    const stored = await t.query(async (ctx) => ({
      attempts: await ctx.db.query("tryoutAttempts").collect(),
      progress: await ctx.db.query("tryoutSetProgress").collect(),
      placements: await ctx.db.query("tryoutAttemptPlacements").collect(),
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
    }));
    expect(stored).toEqual({
      attempts: [],
      progress: [],
      placements: [],
      jobs: [],
    });
  });
});
