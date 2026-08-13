import { verifyRetainedArtifacts } from "@repo/backend/convex/contentRelease/cutover/artifacts";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  prepareRetainedTryoutHistory,
  provideHistoryTestTrust,
  seedRetainedTryoutHistory,
} from "@repo/backend/test/tryout-history";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("contentRelease/cutover/artifacts", () => {
  it("authenticates every artifact retained by historical placements", async () => {
    const t = convexTest(schema, convexModules);
    const fixture = await t.mutation(async (ctx) => {
      const seeded = await seedRetainedTryoutHistory(ctx);
      await prepareRetainedTryoutHistory(ctx, seeded);
      return seeded;
    });

    const receipt = await t.action((ctx) =>
      Effect.runPromise(
        provideHistoryTestTrust(verifyRetainedArtifacts(ctx, fixture.plan))
      )
    );

    expect(receipt).toEqual({ artifacts: 4, placements: 2 });
  });

  it("rejects retained artifact bytes that no longer authenticate", async () => {
    const t = convexTest(schema, convexModules);
    const fixture = await t.mutation(async (ctx) => {
      const seeded = await seedRetainedTryoutHistory(ctx);
      await prepareRetainedTryoutHistory(ctx, seeded);
      const artifact = await ctx.db.query("contentArtifacts").first();
      if (!artifact) {
        throw new Error("Expected retained artifact fixture.");
      }
      await ctx.db.patch("contentArtifacts", artifact._id, {
        artifactJson: "{}",
      });
      return seeded;
    });

    const result = await t.action((ctx) =>
      Effect.runPromise(
        provideHistoryTestTrust(
          verifyRetainedArtifacts(ctx, fixture.plan)
        ).pipe(
          Effect.match({
            onFailure: (error) => ({ code: error.code, tag: error._tag }),
            onSuccess: () => ({ code: null, tag: null }),
          })
        )
      )
    );

    expect(result).toEqual({
      code: "CONTENT_RELEASE_INTEGRITY",
      tag: "ReleaseError",
    });
  });
});
