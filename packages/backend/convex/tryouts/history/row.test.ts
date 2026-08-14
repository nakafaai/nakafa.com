import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { hasRetainedHistoryArtifactReference } from "@repo/backend/convex/tryouts/history/row";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("tryouts/history/row", () => {
  it("reports artifact references after mutable source deletion", async () => {
    const t = convexTest(schema, convexModules);
    const result = await t.mutation(async (ctx) => {
      const questionArtifactHash = `sha256:${"d".repeat(64)}`;
      await ctx.db.insert("tryoutHistoryRows", {
        answerArtifactHash: `sha256:${"c".repeat(64)}`,
        index: 54,
        questionArtifactHash,
        rowHash: `sha256:${"e".repeat(64)}`,
        rowJson: "{}",
        rowKind: "placement",
        snapshotId: `sha256:${"a".repeat(64)}`,
      });
      const before = await runConvexProgram(
        hasRetainedHistoryArtifactReference(ctx, questionArtifactHash)
      );
      const after = await runConvexProgram(
        hasRetainedHistoryArtifactReference(ctx, questionArtifactHash)
      );
      const unrelated = await runConvexProgram(
        hasRetainedHistoryArtifactReference(ctx, `sha256:${"f".repeat(64)}`)
      );
      return { after, before, unrelated };
    });

    expect(result).toEqual({ after: true, before: true, unrelated: false });
  });
});
