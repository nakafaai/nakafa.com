import { describe, expect, it } from "@effect/vitest";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import {
  type TryoutAttemptAccessSourceKind,
  tryoutAttemptAccessSourceKindCompetition,
  tryoutAttemptAccessSourceKindFree,
  tryoutAttemptAccessSourceKindSubscription,
} from "@repo/backend/convex/tryouts/access/source";
import { startSectionAttempt } from "@repo/backend/convex/tryouts/runtime/sectionAttempt";
import { createTryoutAttempt } from "@repo/backend/convex/tryouts/start/attempt";
import { loadTryoutStartSource } from "@repo/backend/convex/tryouts/start/source";
import {
  activateTryoutStartSource,
  TRYOUT_START_NOW as NOW,
  TRYOUT_START_COUNTRY,
  TRYOUT_START_EXAM,
  TRYOUT_START_SECTION,
  TRYOUT_START_SET,
  TRYOUT_START_TRACK,
} from "@repo/backend/test/tryout/source";

describe("tryouts/start/attempt", () => {
  it.each([
    tryoutAttemptAccessSourceKindFree,
    tryoutAttemptAccessSourceKindSubscription,
    tryoutAttemptAccessSourceKindCompetition,
  ] satisfies readonly TryoutAttemptAccessSourceKind[])(
    "keeps the full attempt window after %s attribution expires",
    async (accessSourceKind) => {
      const t = createConvexTestWithBetterAuth();
      const stored = await t.mutation(async (ctx) => {
        const user = await seedAuthenticatedUser(ctx, {
          now: NOW,
          suffix: `full-window-${accessSourceKind}`,
        });
        await activateTryoutStartSource(ctx, "visible", "raw");
        const args = {
          countryKey: TRYOUT_START_COUNTRY,
          examKey: TRYOUT_START_EXAM,
          locale: "id" as const,
          setKey: TRYOUT_START_SET,
          trackKey: TRYOUT_START_TRACK,
        };
        const source = await runConvexProgram(loadTryoutStartSource(ctx, args));
        const attempt = await runConvexProgram(
          createTryoutAttempt(ctx, {
            access: {
              accessEndsAt: NOW + 60_000,
              accessSourceKind,
              countsForCompetition:
                accessSourceKind === tryoutAttemptAccessSourceKindCompetition,
            },
            args,
            attemptNumber: 1,
            now: NOW,
            scaleVersion: null,
            source,
            userId: user.userId,
          })
        );
        await runConvexProgram(
          startSectionAttempt(ctx, {
            attempt,
            now: NOW + 120_000,
            sectionKey: TRYOUT_START_SECTION,
          })
        );
        return {
          attempt,
          section: await ctx.db.query("tryoutSectionAttempts").first(),
        };
      });
      expect(stored.attempt).toMatchObject({
        accessEndsAt: NOW + 60_000,
        accessSourceKind,
        expiresAt: NOW + 3 * 86_400_000,
      });
      expect(stored.section).toMatchObject({
        startedAt: NOW + 120_000,
        status: "in-progress",
      });
      expect(stored.section?.expiresAt).toBeGreaterThan(NOW + 120_000);
    }
  );

  it("rolls back the new attempt if its progress row cannot be written", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "start-progress-failure",
      });
      await activateTryoutStartSource(ctx, "visible", "raw");
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
