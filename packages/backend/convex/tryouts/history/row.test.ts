import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { hasRetainedHistoryArtifactReference } from "@repo/backend/convex/tryouts/history/row";
import { seedRetainedTryoutHistory } from "@repo/backend/test/tryout-history";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("tryouts/history/row", () => {
  it("reports artifact references after mutable source deletion", async () => {
    const t = convexTest(schema, convexModules);
    const result = await t.mutation(async (ctx) => {
      await seedRetainedTryoutHistory(ctx);
      const source = await ctx.db.query("tryoutPlacements").first();
      if (!source) {
        throw new Error("Expected retained placement source fixture.");
      }
      const before = await runConvexProgram(
        hasRetainedHistoryArtifactReference(ctx, source.questionArtifactHash)
      );
      await ctx.db.delete(source._id);
      const after = await runConvexProgram(
        hasRetainedHistoryArtifactReference(ctx, source.questionArtifactHash)
      );
      const unrelated = await runConvexProgram(
        hasRetainedHistoryArtifactReference(ctx, `sha256:${"f".repeat(64)}`)
      );
      return { after, before, unrelated };
    });

    expect(result).toEqual({ after: true, before: true, unrelated: false });
  });
});
