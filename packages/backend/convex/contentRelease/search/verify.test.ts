import { describe, expect, it } from "@effect/vitest";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { loadSearchOwner } from "@repo/backend/convex/contentRelease/search/owner";
import { resolveSearchProjection } from "@repo/backend/convex/contentRelease/search/verify";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  insertRuntimeArticles,
  testArticleProjection,
} from "@repo/backend/test/content/runtime";
import { insertRuntimeIndex } from "@repo/backend/test/runtime/head";
import { TEST_RUNTIME_RELEASE } from "@repo/backend/test/runtime/values";

describe("search result publication integrity", () => {
  it("requires every indexed hit to match its active slot and immutable publication", async () => {
    const t = createConvexTestWithBetterAuth();
    const projection = testArticleProjection(0);
    await t.mutation(async (ctx) => {
      await insertRuntimeArticles(ctx, 1);
      await insertRuntimeIndex(ctx, projection.contentKey);
      const state = await ctx.db.query("contentState").unique();
      if (!state) {
        return expect.fail("Expected an active publication state.");
      }
      await ctx.db.patch(state._id, {
        searchManifestHash: TEST_RUNTIME_RELEASE.manifestHash,
        searchReleaseId: TEST_RUNTIME_RELEASE.releaseId,
        searchSequence: TEST_RUNTIME_RELEASE.sequence,
      });
    });
    const read = () =>
      t.query(async (ctx) => {
        const owner = await runConvexProgram(loadSearchOwner(ctx));
        const row = await ctx.db.query("contentIndex").unique();
        if (!(owner && row)) {
          return expect.fail("Expected one active search hit.");
        }
        return runConvexProgram(resolveSearchProjection(ctx, row, owner));
      });
    expect(await read()).toMatchObject({
      contentKey: projection.contentKey,
      publicPath: projection.publicPath,
      projection,
    });
    const original = await t.query((ctx) =>
      ctx.db.query("contentIndex").unique()
    );
    if (!original) {
      return expect.fail("Expected one active search hit.");
    }
    const patches: readonly Partial<Doc<"contentIndex">>[] = [
      { slot: "green" },
      { family: "material" },
      { projectionHash: `sha256:${"f".repeat(64)}` },
    ];
    for (const patch of patches) {
      await t.mutation((ctx) =>
        ctx.db.patch(original._id, {
          family: original.family,
          projectionHash: original.projectionHash,
          slot: original.slot,
          ...patch,
        })
      );
      await expect(read()).rejects.toMatchObject({
        data: {
          code: "CONTENT_RELEASE_INTEGRITY",
          message: `Active search entry ${projection.contentKey}/en is stale.`,
        },
      });
    }
  });
});
