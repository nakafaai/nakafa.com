import { api } from "@repo/backend/convex/_generated/api";
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
import { makeQuranSearch } from "@repo/backend/test/quran-rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran-snapshot";
import { insertRuntimeIndex } from "@repo/backend/test/runtime-head";
import { TEST_RUNTIME_RELEASE } from "@repo/backend/test/runtime-values";
import {
  activateTryoutSnapshot,
  makeTryoutCatalogRow,
  makeTryoutPlacementRow,
} from "@repo/backend/test/tryout-snapshot";
import { NAKAFA_AGENT_SEARCH_WINDOW } from "@repo/contents/_types/agent/search";
import { describe, expect, it } from "vitest";

const MARKDOWN_PATH_PATTERN = /\.md$/;

/** Activates signed articles and their authenticated search rows. */
async function activateArticleSearch(
  count: number,
  textAt: (index: number) => string
) {
  const t = createConvexTestWithBetterAuth();
  await t.mutation(async (ctx) => {
    await insertRuntimeArticles(ctx, count);
    for (let index = 0; index < count; index += 1) {
      const projection = testArticleProjection(index);
      await insertRuntimeIndex(ctx, projection.contentKey, {
        plainText: textAt(index),
      });
    }
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
  return t;
}

describe("contents/queries/search:search", () => {
  it("searches authenticated article text and returns a readable reference", async () => {
    const t = await activateArticleSearch(2, (index) =>
      index === 0
        ? "rational function grade eleven asymptote"
        : "unrelated editorial text"
    );

    const result = await t.query(api.contents.queries.search.search, {
      limit: 10,
      locale: "en",
      offset: 0,
      queries: ["rational function"],
      section: "articles",
    });

    expect(result.items).toEqual([
      expect.objectContaining({
        content_id: testArticleProjection(0).graph.assetId,
        excerpt: expect.stringContaining("rational function"),
        markdown_url: expect.stringMatching(MARKDOWN_PATH_PATTERN),
        route: testArticleProjection(0).publicPath,
        section: "articles",
      }),
    ]);
  });

  it("resolves an exact current material route", async () => {
    const t = createConvexTestWithBetterAuth();
    const projection = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(t, [projection]);
    await t.mutation(async (ctx) => {
      await insertRuntimeIndex(ctx, projection.contentKey, {
        artifactLocale: projection.artifactLocale,
        headSequence: MATERIAL_IDENTITY.sequence,
        plainText: "current signed material",
      });
      const state = await ctx.db.query("contentState").unique();
      if (!state) {
        throw new Error("Expected one active content state.");
      }
      await ctx.db.patch("contentState", state._id, {
        searchManifestHash: MATERIAL_IDENTITY.manifestHash,
        searchReleaseId: MATERIAL_IDENTITY.releaseId,
        searchSequence: MATERIAL_IDENTITY.sequence,
      });
    });

    const result = await t.query(api.contents.queries.search.search, {
      limit: 5,
      locale: "en",
      offset: 0,
      queries: [projection.publicPath],
      section: "material",
    });

    expect(result.items).toEqual([
      expect.objectContaining({
        content_id: projection.graph.assetId,
        route: projection.publicPath,
        section: "material",
      }),
    ]);
  });

  it("browses current articles in stable route order", async () => {
    const t = await activateArticleSearch(3, () => "browse article");

    const result = await t.query(api.contents.queries.search.search, {
      limit: 2,
      locale: "en",
      offset: 0,
      section: "articles",
    });

    expect(result).toMatchObject({ count: 2, has_more: true, next_offset: 2 });
    expect(result.items.map(({ route }) => route)).toEqual([
      testArticleProjection(0).publicPath,
      testArticleProjection(1).publicPath,
    ]);
  });

  it("returns signed Quran rows through the unified query", async () => {
    const t = createConvexTestWithBetterAuth();
    await t.mutation((ctx) =>
      activateQuranSnapshot(ctx, [
        makeQuranSearch("en", 1, "signed mercy guidance"),
      ])
    );

    const result = await t.query(api.contents.queries.search.search, {
      limit: 10,
      locale: "en",
      offset: 0,
      queries: ["signed mercy"],
      section: "quran",
    });

    expect(result.items).toMatchObject([
      {
        content_id: "asset:en:quran:quran-surah:1",
        markdown_url: "https://nakafa.com/en/quran/1.md",
        route: "quran/1",
        section: "quran",
      },
    ]);
  });

  it("returns bodyless Tryout catalog refs without claiming markdown", async () => {
    const t = createConvexTestWithBetterAuth();
    await t.mutation((ctx) =>
      activateTryoutSnapshot(ctx, {
        catalog: [
          makeTryoutCatalogRow("en").record.row,
          makeTryoutCatalogRow("id").record.row,
        ],
        placements: [
          makeTryoutPlacementRow("en").record.row,
          makeTryoutPlacementRow("id").record.row,
        ],
      })
    );

    const result = await t.query(api.contents.queries.search.search, {
      limit: 10,
      locale: "en",
      offset: 0,
      queries: ["Technical country"],
      section: "tryout",
    });

    expect(result.items).toEqual([
      expect.objectContaining({
        content_id: "asset:en:tryout:technical:country",
        route: "try-out/indonesia",
        section: "tryout",
      }),
    ]);
    expect(result.items[0]).not.toHaveProperty("markdown_url");
  });

  it("caps the shared signed search window", async () => {
    const t = createConvexTestWithBetterAuth();
    await t.mutation((ctx) =>
      activateQuranSnapshot(
        ctx,
        Array.from({ length: NAKAFA_AGENT_SEARCH_WINDOW + 1 }, (_, index) =>
          makeQuranSearch("en", index + 1, `search window ${index + 1}`)
        )
      )
    );

    const result = await t.query(api.contents.queries.search.search, {
      limit: 1,
      locale: "en",
      offset: NAKAFA_AGENT_SEARCH_WINDOW - 1,
      section: "quran",
    });

    expect(result).toMatchObject({
      count: 1,
      has_more: false,
      items: [{ route: `quran/${NAKAFA_AGENT_SEARCH_WINDOW}` }],
      offset: NAKAFA_AGENT_SEARCH_WINDOW - 1,
    });
  });
});
