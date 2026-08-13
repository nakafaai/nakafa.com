import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { migrateAppLocale } from "@repo/backend/convex/tryouts/history/locale";
import {
  fixtureAttemptId,
  provideHistoryTestTrust,
  seedRetainedTryoutHistory,
} from "@repo/backend/test/tryout-history";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("tryouts/history/locale", () => {
  it("copies required locale into appLocale without deleting legacy fields", async () => {
    const t = convexTest(schema, convexModules);
    const result = await t.mutation(async (ctx) => {
      const fixture = await seedRetainedTryoutHistory(ctx);
      const attempts = await runConvexProgram(
        provideHistoryTestTrust(migrateAppLocale(ctx, fixture.plan, "attempt"))
      );
      const progress = await runConvexProgram(
        provideHistoryTestTrust(migrateAppLocale(ctx, fixture.plan, "progress"))
      );
      const retry = await runConvexProgram(
        provideHistoryTestTrust(migrateAppLocale(ctx, fixture.plan, "attempt"))
      );
      return {
        attempts,
        progress,
        retry,
        storedAttempts: await ctx.db.query("tryoutAttempts").collect(),
        storedProgress: await ctx.db.query("tryoutSetProgress").collect(),
      };
    });

    expect(result.attempts.updated).toBe(2);
    expect(result.progress.updated).toBe(1);
    expect(result.retry.updated).toBe(0);
    expect(
      result.storedAttempts.every((row) => row.appLocale === row.locale)
    ).toBe(true);
    expect(
      result.storedProgress.every((row) => row.appLocale === row.locale)
    ).toBe(true);
  });

  it("rejects an appLocale that conflicts with required locale", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.mutation(async (ctx) => {
        const fixture = await seedRetainedTryoutHistory(ctx);
        await ctx.db.patch(fixtureAttemptId(fixture, 0), { appLocale: "id" });
        await runConvexProgram(
          provideHistoryTestTrust(
            migrateAppLocale(ctx, fixture.plan, "attempt")
          )
        );
      })
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_HISTORY_NOT_READY" },
    });
  });
});
