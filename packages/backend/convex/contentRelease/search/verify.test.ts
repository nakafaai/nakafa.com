import { describe, expect, it } from "@effect/vitest";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { loadSearchOwner } from "@repo/backend/convex/contentRelease/search/owner";
import { resolveSearchProjection } from "@repo/backend/convex/contentRelease/search/verify";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  insertTestPage,
  TEST_PAGE_KEY,
  TEST_PAGE_PATH,
} from "@repo/backend/test/content/page";
import { testTextHash } from "@repo/backend/test/content/release";
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
    const owner = await t.query((ctx) =>
      runConvexProgram(loadSearchOwner(ctx))
    );
    if (!owner) {
      return expect.fail("Expected one active search owner.");
    }
    const read = (selectedOwner = owner) =>
      t.query(async (ctx) => {
        const row = await ctx.db.query("contentIndex").unique();
        if (!row) {
          return expect.fail("Expected one active search hit.");
        }
        return runConvexProgram(
          resolveSearchProjection(ctx, row, selectedOwner)
        );
      });
    expect(await read()).toMatchObject({
      contentKey: projection.contentKey,
      publicPath: projection.publicPath,
      projection,
    });
    await expect(read({ ...owner, families: [] })).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
    const original = await t.query((ctx) =>
      ctx.db.query("contentIndex").unique()
    );
    if (!original) {
      return expect.fail("Expected one active search hit.");
    }
    const identity = {
      appLocale: original.appLocale,
      contentKey: original.contentKey,
      family: original.family,
      projectionHash: original.projectionHash,
      publicPath: original.publicPath,
      releaseId: original.releaseId,
      sequence: original.sequence,
      slot: original.slot,
    };
    const patches: readonly Partial<Doc<"contentIndex">>[] = [
      { slot: "green" },
      { family: "material" },
      { appLocale: "id" },
      { projectionHash: `sha256:${"f".repeat(64)}` },
      { publicPath: "articles/politics/other-route" },
      { releaseId: "different-release" },
      { sequence: original.sequence + 1 },
    ];
    for (const patch of patches) {
      await t.mutation((ctx) =>
        ctx.db.patch(original._id, {
          ...identity,
          ...patch,
        })
      );
      await expect(read()).rejects.toMatchObject({
        data: {
          code: "CONTENT_RELEASE_INTEGRITY",
          message: `Active search entry ${projection.contentKey}/${patch.appLocale ?? original.appLocale} is stale.`,
        },
      });
    }

    await t.mutation(async (ctx) => {
      const page = await insertTestPage(
        ctx,
        "en",
        "terms-of-service",
        TEST_PAGE_PATH
      );
      await ctx.db.patch(original._id, {
        ...identity,
        contentKey: TEST_PAGE_KEY,
        projectionHash: testTextHash(page),
        publicPath: TEST_PAGE_PATH,
      });
    });
    await expect(read()).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_INTEGRITY",
        message: `Active search entry ${TEST_PAGE_KEY}/en is stale.`,
      },
    });
  });
});
