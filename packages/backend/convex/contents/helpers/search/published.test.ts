import { loadSearchOwner } from "@repo/backend/convex/contentRelease/search/owner";
import { readPublishedSearchDocuments } from "@repo/backend/convex/contents/helpers/search/published";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { makeMaterialProjection } from "@repo/backend/test/content-material";
import {
  insertRuntimeArticles,
  testArticleProjection,
} from "@repo/backend/test/content-runtime";
import {
  activateMaterialCatalog,
  MATERIAL_IDENTITY,
} from "@repo/backend/test/material-catalog";
import { insertRuntimeIndex } from "@repo/backend/test/runtime-head";
import { TEST_RUNTIME_RELEASE } from "@repo/backend/test/runtime-values";
import { describe, expect, it } from "vitest";

/** Reads one published article window through the production owner boundary. */
function readArticles(
  t: ReturnType<typeof createConvexTestWithBetterAuth>,
  queries: readonly string[],
  scanLimit: number
) {
  return t.query(async (ctx) => {
    const owner = await runConvexProgram(loadSearchOwner(ctx));
    if (!owner) {
      throw new Error("Expected one active search owner.");
    }
    return runConvexProgram(
      readPublishedSearchDocuments(
        ctx,
        {
          limit: scanLimit,
          locale: "en",
          offset: 0,
          queries: [...queries],
          section: "articles",
        },
        queries,
        scanLimit,
        owner,
        ["article"]
      )
    );
  });
}

/** Activates the release-owned search identity used by published read tests. */
async function activateSearch(
  t: ReturnType<typeof createConvexTestWithBetterAuth>
) {
  await t.mutation(async (ctx) => {
    const state = await ctx.db.query("contentState").unique();
    if (!state) {
      throw new Error("Expected one active content state.");
    }
    await ctx.db.patch("contentState", state._id, {
      searchManifestHash: TEST_RUNTIME_RELEASE.manifestHash,
      searchReleaseId: TEST_RUNTIME_RELEASE.releaseId,
      searchSequence: TEST_RUNTIME_RELEASE.sequence,
    });
  });
}

describe("readPublishedSearchDocuments", () => {
  it("keeps smaller pages stable across empty and overlapping queries", async () => {
    const t = createConvexTestWithBetterAuth();
    const queries = ["missing", "alpha", "beta", "gamma"];
    const texts = [
      "alpha beta bounded search",
      "beta bounded search",
      "gamma bounded search",
    ];

    await t.mutation(async (ctx) => {
      await insertRuntimeArticles(ctx, texts.length);
      for (const [index, text] of texts.entries()) {
        const projection = testArticleProjection(index);
        await insertRuntimeIndex(ctx, projection.contentKey, {
          plainText: text,
        });
      }
    });
    await activateSearch(t);

    const firstPage = await readArticles(t, queries, 2);
    const fullWindow = await readArticles(t, queries, 4);

    expect(firstPage).toHaveLength(2);
    expect(firstPage).toEqual(fullWindow.slice(0, firstPage.length));
    expect(
      new Set(fullWindow.map((document) => document.content_id)).size
    ).toBe(fullWindow.length);
  });

  it("fills the window when an exact route repeats in search hits", async () => {
    const t = createConvexTestWithBetterAuth();
    const exact = testArticleProjection(0);

    await t.mutation(async (ctx) => {
      await insertRuntimeArticles(ctx, 4);
      for (let index = 0; index < 4; index += 1) {
        const projection = testArticleProjection(index);
        await insertRuntimeIndex(ctx, projection.contentKey, {
          plainText: `${exact.publicPath} related article`,
        });
      }
    });
    await activateSearch(t);

    const documents = await readArticles(t, [exact.publicPath], 3);

    expect(documents).toHaveLength(3);
    expect(documents[0]?.content_id).toBe(exact.graph.assetId);
    expect(new Set(documents.map((document) => document.content_id)).size).toBe(
      documents.length
    );
  });

  it("browses current materials in stable public-path order", async () => {
    const t = createConvexTestWithBetterAuth();
    const projections = Array.from({ length: 40 }, (_, index) =>
      makeMaterialProjection("en", 1, index + 1)
    );
    await activateMaterialCatalog(t, projections);
    await t.mutation(async (ctx) => {
      for (const projection of projections) {
        await insertRuntimeIndex(ctx, projection.contentKey, {
          artifactLocale: projection.artifactLocale,
          headSequence: MATERIAL_IDENTITY.sequence,
          plainText: "bounded published material",
        });
      }
      const state = await ctx.db.query("contentState").unique();
      if (!state) {
        expect.fail("Expected one active content state.");
      }
      await ctx.db.patch("contentState", state._id, {
        searchManifestHash: MATERIAL_IDENTITY.manifestHash,
        searchReleaseId: MATERIAL_IDENTITY.releaseId,
        searchSequence: MATERIAL_IDENTITY.sequence,
      });
    });
    const documents = await t.query(async (ctx) => {
      const owner = await runConvexProgram(loadSearchOwner(ctx));
      if (!owner) {
        expect.fail("Expected one active search owner.");
      }
      return runConvexProgram(
        readPublishedSearchDocuments(
          ctx,
          {
            limit: 2,
            locale: "en",
            offset: 0,
            queries: [],
            section: "material",
          },
          [],
          2,
          owner,
          ["material"]
        )
      );
    });

    const expected = projections
      .map(({ publicPath }) => publicPath)
      .sort()
      .slice(0, 2);
    expect(documents.map(({ route }) => route)).toEqual(expected);
  });
});
