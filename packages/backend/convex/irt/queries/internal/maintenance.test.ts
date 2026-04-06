import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 3, 3, 12, 0, 0);

async function insertActiveTryout(ctx: MutationCtx, slug: string) {
  return await ctx.db.insert("tryouts", {
    catalogPosition: 1,
    product: "snbt",
    locale: "id",
    cycleKey: "2026",
    slug,
    label: slug,
    partCount: 0,
    totalQuestionCount: 0,
    isActive: true,
    detectedAt: NOW,
    syncedAt: NOW,
  });
}

describe("irt/queries/internal/maintenance", () => {
  it("treats blocked tryouts with published provisional scales as startable", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      const tryoutId = await insertActiveTryout(ctx, "blocked-but-startable");

      await ctx.db.insert("irtScaleQualityChecks", {
        tryoutId,
        status: "blocked",
        blockingReason: "missing-calibrated-items",
        totalQuestionCount: 150,
        calibratedQuestionCount: 0,
        staleQuestionCount: 0,
        minAttemptCount: 0,
        liveWindowStartAt: NOW,
        checkedAt: NOW,
      });
      await ctx.db.insert("irtScaleVersions", {
        tryoutId,
        model: "2pl",
        status: "provisional",
        questionCount: 150,
        publishedAt: NOW,
      });
    });

    const result = await t.query(
      internal.irt.queries.internal.maintenance.getScaleQualityIntegrity,
      {
        paginationOpts: {
          cursor: null,
          numItems: 100,
        },
      }
    );

    expect(result).toEqual({
      continueCursor: expect.any(String),
      isDone: true,
      missingQualityCheckTryoutCount: 0,
      unstartableTryoutCount: 0,
    });
  });

  it("flags active tryouts missing a quality check and frozen scale", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await insertActiveTryout(ctx, "missing-quality-and-scale");
    });

    const result = await t.query(
      internal.irt.queries.internal.maintenance.getScaleQualityIntegrity,
      {
        paginationOpts: {
          cursor: null,
          numItems: 100,
        },
      }
    );

    expect(result).toEqual({
      continueCursor: expect.any(String),
      isDone: true,
      missingQualityCheckTryoutCount: 1,
      unstartableTryoutCount: 1,
    });
  });
});
