import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { copyHistoryRows } from "@repo/backend/convex/tryouts/history/copy";
import { hasRetainedHistoryArtifactReference } from "@repo/backend/convex/tryouts/history/row";
import { seedRetainedTryoutHistory } from "@repo/backend/test/tryout-history";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("tryouts/history/row", () => {
  it("reports artifact references from retained history only", async () => {
    const t = convexTest(schema, convexModules);
    const result = await t.mutation(async (ctx) => {
      const fixture = await seedRetainedTryoutHistory(ctx);
      const source = await ctx.db.query("tryoutPlacements").first();
      if (!source) {
        throw new Error("Expected retained placement source fixture.");
      }
      const before = await runConvexProgram(
        hasRetainedHistoryArtifactReference(ctx, source.questionArtifactHash)
      );
      await runConvexProgram(
        copyHistoryRows(ctx, fixture.plan, "placement", 1)
      );
      const after = await runConvexProgram(
        hasRetainedHistoryArtifactReference(ctx, source.questionArtifactHash)
      );
      const unrelated = await runConvexProgram(
        hasRetainedHistoryArtifactReference(ctx, `sha256:${"f".repeat(64)}`)
      );
      return { after, before, unrelated };
    });

    expect(result).toEqual({ after: true, before: false, unrelated: false });
  });
});
