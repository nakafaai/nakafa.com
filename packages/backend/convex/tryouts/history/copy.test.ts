import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { copyHistoryRows } from "@repo/backend/convex/tryouts/history/copy";
import { seedRetainedTryoutHistory } from "@repo/backend/test/tryout-history";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const SHA256_PREFIX = /^sha256:/;

describe("tryouts/history/copy", () => {
  it("copies exact signed catalog and placement envelopes idempotently", async () => {
    const t = convexTest(schema, convexModules);
    const result = await t.mutation(async (ctx) => {
      const fixture = await seedRetainedTryoutHistory(ctx);
      const catalog = await runConvexProgram(
        copyHistoryRows(ctx, fixture.plan, "catalog", -1)
      );
      const placement = await runConvexProgram(
        copyHistoryRows(ctx, fixture.plan, "placement", 1)
      );
      const catalogRetry = await runConvexProgram(
        copyHistoryRows(ctx, fixture.plan, "catalog", -1)
      );
      const rows = await ctx.db.query("tryoutHistoryRows").collect();
      return { catalog, catalogRetry, placement, rows };
    });

    expect(result.catalog).toMatchObject({ created: 2, done: true });
    expect(result.placement).toMatchObject({ created: 2, done: true });
    expect(result.catalogRetry).toMatchObject({
      created: 0,
      unchanged: 2,
    });
    expect(result.rows).toHaveLength(4);
    expect(
      result.rows.filter(({ rowKind }) => rowKind === "placement")
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          answerArtifactHash: expect.stringMatching(SHA256_PREFIX),
          questionArtifactHash: expect.stringMatching(SHA256_PREFIX),
        }),
      ])
    );
  });

  it("does not retain placement history after its artifact disappears", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.mutation(async (ctx) => {
        const fixture = await seedRetainedTryoutHistory(ctx);
        const artifact = await ctx.db.query("contentArtifacts").first();
        if (!artifact) {
          throw new Error("Expected retained artifact fixture.");
        }
        await ctx.db.delete("contentArtifacts", artifact._id);
        await runConvexProgram(
          copyHistoryRows(ctx, fixture.plan, "placement", 1)
        );
      })
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_HISTORY_NOT_READY" },
    });
  });
});
