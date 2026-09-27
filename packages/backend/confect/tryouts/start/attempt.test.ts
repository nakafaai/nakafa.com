import { RegisteredConvexFunction } from "@confect/server";
import { describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import {
  type TryoutAttemptAccessSourceKind,
  tryoutAttemptAccessSourceKindFree,
  tryoutAttemptAccessSourceKindSubscription,
} from "@repo/backend/confect/tryouts/access/source";
import { startSectionAttempt } from "@repo/backend/confect/tryouts/runtime/sectionAttempt";
import { createTryoutAttempt } from "@repo/backend/confect/tryouts/start/attempt";
import { loadTryoutStartSource } from "@repo/backend/confect/tryouts/start/source";
import {
  activateTryoutStartSource,
  TRYOUT_START_NOW as NOW,
  TRYOUT_START_COUNTRY,
  TRYOUT_START_EXAM,
  TRYOUT_START_SECTION,
  TRYOUT_START_SET,
  TRYOUT_START_TRACK,
} from "@repo/backend/test/tryout/source";
import { Effect } from "effect";

describe("tryouts/start/attempt", () => {
  it.each([
    tryoutAttemptAccessSourceKindFree,
    tryoutAttemptAccessSourceKindSubscription,
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
        const source = await Effect.runPromise(
          loadTryoutStartSource(args).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        );
        const attempt = await Effect.runPromise(
          createTryoutAttempt({
            access: {
              accessEndsAt: NOW + 60_000,
              accessSourceKind,
              countsForCompetition: false,
            },
            args,
            attemptNumber: 1,
            now: NOW,
            scaleVersion: null,
            source,
            userId: user.userId,
          }).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        );
        await Effect.runPromise(
          startSectionAttempt({
            attempt,
            now: NOW + 120_000,
            sectionKey: TRYOUT_START_SECTION,
          }).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
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
        const source = await Effect.runPromise(
          loadTryoutStartSource(args).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        );
        vi.spyOn(ctx.db, "query").mockImplementationOnce(() => {
          throw new Error("Progress storage unavailable.");
        });
        return Effect.runPromise(
          createTryoutAttempt({
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
          }).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        );
      })
    ).rejects.toMatchObject({
      code: "TRYOUT_PROGRESS_WRITE_FAILED",
      message: "Unable to update try-out progress.",
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
