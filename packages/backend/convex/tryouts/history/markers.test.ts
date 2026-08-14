import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { finalizeRetainedTryoutHistory } from "@repo/backend/convex/tryouts/history/finalize";
import { proveRetainedHistoryMarkers } from "@repo/backend/convex/tryouts/history/markers";
import {
  prepareRetainedTryoutHistory,
  provideHistoryTestTrust,
  seedRetainedTryoutHistory,
} from "@repo/backend/test/tryout-history";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("tryouts/history/markers", () => {
  it("does not report completion before exact markers exist", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.mutation(async (ctx) => {
        const fixture = await seedRetainedTryoutHistory(ctx);
        await prepareRetainedTryoutHistory(ctx, fixture);
        return runConvexProgram(proveRetainedHistoryMarkers(ctx, fixture.plan));
      })
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_HISTORY_NOT_READY" },
    });
  });

  it("proves the compact atomic marker witness", async () => {
    const t = convexTest(schema, convexModules);
    const proof = await t.mutation(async (ctx) => {
      const fixture = await seedRetainedTryoutHistory(ctx);
      await prepareRetainedTryoutHistory(ctx, fixture);
      await runConvexProgram(
        provideHistoryTestTrust(
          finalizeRetainedTryoutHistory(ctx, fixture.plan)
        )
      );
      return runConvexProgram(proveRetainedHistoryMarkers(ctx, fixture.plan));
    });

    expect(proof).toMatchObject({
      attempts: 2,
      declaredFrozenPlacements: 2,
      markers: 2,
      releases: [
        { attempts: 1, releaseId: "retained-history-a" },
        { attempts: 1, releaseId: "retained-history-b" },
      ],
    });
  });

  it("rejects an attempt changed after marker creation", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.mutation(async (ctx) => {
        const fixture = await seedRetainedTryoutHistory(ctx);
        await prepareRetainedTryoutHistory(ctx, fixture);
        await runConvexProgram(
          provideHistoryTestTrust(
            finalizeRetainedTryoutHistory(ctx, fixture.plan)
          )
        );
        const attempt = await ctx.db.query("tryoutAttempts").first();
        if (!attempt) {
          throw new Error("Expected one retained attempt fixture.");
        }
        await ctx.db.patch("tryoutAttempts", attempt._id, {
          appLocale: attempt.locale === "en" ? "id" : "en",
        });
        return runConvexProgram(proveRetainedHistoryMarkers(ctx, fixture.plan));
      })
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_HISTORY_INTEGRITY" },
    });
  });

  it("rejects a retained release split changed after marker creation", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.mutation(async (ctx) => {
        const fixture = await seedRetainedTryoutHistory(ctx);
        await prepareRetainedTryoutHistory(ctx, fixture);
        await runConvexProgram(
          provideHistoryTestTrust(
            finalizeRetainedTryoutHistory(ctx, fixture.plan)
          )
        );
        const attempts = await ctx.db.query("tryoutAttempts").take(2);
        const first = attempts[0];
        const second = attempts[1];
        if (
          !(first && second) ||
          first.snapshotReleaseId === second.snapshotReleaseId
        ) {
          throw new Error("Expected attempts from two retained releases.");
        }
        await ctx.db.patch("tryoutAttempts", first._id, {
          snapshotReleaseId: second.snapshotReleaseId,
        });
        return runConvexProgram(proveRetainedHistoryMarkers(ctx, fixture.plan));
      })
    ).rejects.toMatchObject({
      data: {
        code: "TRYOUT_HISTORY_INTEGRITY",
        message: expect.stringContaining("accepted attempt count"),
      },
    });
  });

  it("rejects an altered declared question count", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.mutation(async (ctx) => {
        const fixture = await seedRetainedTryoutHistory(ctx);
        await prepareRetainedTryoutHistory(ctx, fixture);
        await runConvexProgram(
          provideHistoryTestTrust(
            finalizeRetainedTryoutHistory(ctx, fixture.plan)
          )
        );
        const attempt = await ctx.db.query("tryoutAttempts").first();
        if (!attempt) {
          throw new Error("Expected one retained attempt fixture.");
        }
        await ctx.db.patch("tryoutAttempts", attempt._id, {
          totalQuestions: attempt.totalQuestions + 1,
        });
        return runConvexProgram(proveRetainedHistoryMarkers(ctx, fixture.plan));
      })
    ).rejects.toMatchObject({
      data: {
        code: "TRYOUT_HISTORY_INTEGRITY",
        message: expect.stringContaining("declare 3 placements"),
      },
    });
  });

  it("rejects duplicate completion markers", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.mutation(async (ctx) => {
        const fixture = await seedRetainedTryoutHistory(ctx);
        await prepareRetainedTryoutHistory(ctx, fixture);
        await runConvexProgram(
          provideHistoryTestTrust(
            finalizeRetainedTryoutHistory(ctx, fixture.plan)
          )
        );
        const markers = await ctx.db.query("tryoutAttemptHistory").take(2);
        const first = markers[0];
        const second = markers[1];
        if (!(first && second)) {
          throw new Error("Expected two retained history markers.");
        }
        await ctx.db.delete("tryoutAttemptHistory", second._id);
        await ctx.db.insert("tryoutAttemptHistory", {
          snapshotReleaseId: first.snapshotReleaseId,
          tryoutAttemptId: first.tryoutAttemptId,
          tryoutSnapshotId: first.tryoutSnapshotId,
        });
        return runConvexProgram(proveRetainedHistoryMarkers(ctx, fixture.plan));
      })
    ).rejects.toMatchObject({
      data: {
        code: "TRYOUT_HISTORY_INTEGRITY",
        message: expect.stringContaining("does not match retained history"),
      },
    });
  });
});
